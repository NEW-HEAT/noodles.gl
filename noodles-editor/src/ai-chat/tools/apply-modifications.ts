/**
 * Apply Modifications to Noodles Graph
 *
 * Generic graph CRUD engine for AI-driven modifications.
 * Operates on the noodles.gl operator store and graph executor.
 */

import type { ProjectModification, NoodlesNode, InjectDataFn, ApplyResult } from './graph-types'
import { getOp, deleteOp, getAllOps, setOp } from '../../noodles/store'
import { forceUpdate, getExecutor } from '../../noodles/transform-graph'
import { getParentPath } from '../../noodles/utils/path-utils'
import { memoize } from '../../noodles/utils/memoize'

interface ApplyModificationsOptions {
  protectedNodes?: string[]
  colorInputs?: string[]
  colorPresets?: Record<string, number[]>
}

const DEFAULT_PROTECTED_NODES = ['/deck', '/data']

const DEFAULT_COLOR_INPUTS = [
  'clusterFillColor', 'clusterTextColor', 'pointFillColor', 'highlightColor',
]

const DEFAULT_COLOR_PRESETS: Record<string, number[]> = {
  red: [255, 75, 50, 230], blue: [50, 100, 255, 230], green: [50, 200, 100, 230],
  orange: [255, 150, 50, 230], purple: [150, 50, 255, 230], yellow: [255, 220, 50, 230],
  cyan: [50, 220, 255, 230], pink: [255, 100, 200, 230], white: [255, 255, 255, 255],
  black: [0, 0, 0, 255],
}

function rgbaToHex(rgba: number[]): string {
  return `#${rgba.slice(0, 3).map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

function normalizeColorValue(value: unknown, presets: Record<string, number[]>): string | null {
  if (Array.isArray(value) && value.length >= 3 && value.length <= 4 && value.every(v => typeof v === 'number' && v >= 0 && v <= 255)) {
    return rgbaToHex(value)
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim()
    if (presets[lower]) return rgbaToHex(presets[lower])
    const hex = lower.replace('#', '')
    if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}`
  }
  return null
}

function applyUpdateNode(
  nodeId: string,
  data: { data?: { inputs?: Record<string, unknown> } },
  injectData: InjectDataFn,
  colorInputs: Set<string>,
  colorPresets: Record<string, number[]>,
): { success: boolean; error?: string } {
  const inputs = data.data?.inputs
  if (!inputs || typeof inputs !== 'object') return { success: false, error: 'No inputs provided for update_node' }

  const errors: string[] = []
  let anyChanged = false

  for (const [key, value] of Object.entries(inputs)) {
    let normalizedValue = value
    if (colorInputs.has(key)) {
      const colorValue = normalizeColorValue(value, colorPresets)
      if (colorValue === null) {
        errors.push(`Invalid color value for ${key}: ${JSON.stringify(value)}`)
        continue
      }
      normalizedValue = colorValue
    }
    const result = injectData(nodeId, key, normalizedValue)
    if (!result.success) errors.push(`Failed to set ${nodeId}.${key}: ${result.error}`)
    else anyChanged = true
  }

  if (!anyChanged && errors.length === 0) return { success: false, error: `No inputs were modified for node ${nodeId}.` }
  if (errors.length > 0) return { success: false, error: errors.join('; ') }
  return { success: true }
}

function applyDeleteNode(nodeId: string, protectedNodes: Set<string>): { success: boolean; error?: string; warning?: string } {
  if (protectedNodes.has(nodeId)) return { success: false, error: `Node ${nodeId} is protected and cannot be deleted.` }
  const op = getOp(nodeId)
  if (!op) return { success: false, error: `Node ${nodeId} not found in graph.` }

  const allOps = getAllOps()
  let edgesRemoved = 0
  for (const otherOp of allOps) {
    if (otherOp.id === nodeId) continue
    for (const [, field] of Object.entries(otherOp.inputs)) {
      if ((field as any).subscriptions) {
        for (const [subId, sub] of (field as any).subscriptions) {
          if (subId.includes(nodeId) || (sub as { source?: { id?: string } })?.source?.id === nodeId) {
            ;(field as any).removeConnection(subId, 'value')
            edgesRemoved++
          }
        }
      }
    }
  }

  op.dispose?.()
  deleteOp(nodeId)
  return { success: true, warning: edgesRemoved > 0 ? `Removed ${edgesRemoved} connection(s) to deleted node.` : undefined }
}

function applyAddEdge(edgeData: { source: string; target: string; sourceHandle?: string; targetHandle?: string }): { success: boolean; error?: string } {
  const { source, target, sourceHandle, targetHandle } = edgeData
  const sourceOp = getOp(source)
  const targetOp = getOp(target)
  if (!sourceOp) return { success: false, error: `Source node ${source} not found.` }
  if (!targetOp) return { success: false, error: `Target node ${target} not found.` }

  const sourceFieldName = sourceHandle?.split('.').pop() || 'out'
  const targetFieldName = targetHandle?.split('.').pop() || 'in'
  const sourceField = sourceOp.outputs?.[sourceFieldName]
  const targetField = targetOp.inputs?.[targetFieldName]
  if (!sourceField) return { success: false, error: `Source field ${sourceFieldName} not found on ${source}.` }
  if (!targetField) return { success: false, error: `Target field ${targetFieldName} not found on ${target}.` }

  const edgeId = `${source}.${sourceFieldName}->${target}.${targetFieldName}`
  targetField.addConnection(edgeId, sourceField, 'value')
  return { success: true }
}

async function applyAddNode(nodeData: NoodlesNode): Promise<{ success: boolean; error?: string }> {
  const { id, type, data } = nodeData
  if (!id) return { success: false, error: 'Node ID is required for add_node' }
  if (!type) return { success: false, error: 'Node type is required for add_node' }
  if (getOp(id)) return { success: false, error: `Node ${id} already exists. Use update_node to modify it.` }

  try {
    const { opTypes } = await import('../../noodles/operators')
    const OpConstructor = opTypes[type as keyof typeof opTypes]
    if (!OpConstructor) {
      const availableTypes = Object.keys(opTypes).slice(0, 20).join(', ')
      return { success: false, error: `Unknown operator type: ${type}. Available: ${availableTypes}...` }
    }

    const containerId = getParentPath(id)
    const inputs = (data as { inputs?: Record<string, unknown> })?.inputs || data || {}
    const op = new (OpConstructor as any)(id, inputs, false, containerId)
    if ((OpConstructor as any).cacheable) op.execute = memoize(op.execute)
    setOp(id, op as any)
    op.createListeners?.()

    const executor = getExecutor()
    if (executor) executor.addNode(op as any)
    return { success: true }
  } catch (error) {
    return { success: false, error: `Failed to create node: ${error instanceof Error ? error.message : String(error)}` }
  }
}

function applyDeleteEdge(edgeData: { id?: string; source?: string; target?: string; sourceHandle?: string; targetHandle?: string }): { success: boolean; error?: string } {
  if (edgeData.id) {
    const allOps = getAllOps()
    for (const op of allOps) {
      for (const [, field] of Object.entries(op.inputs)) {
        if ((field as any).subscriptions?.has(edgeData.id)) {
          ;(field as any).removeConnection(edgeData.id, 'value')
          return { success: true }
        }
      }
    }
    return { success: false, error: `Edge ${edgeData.id} not found.` }
  }

  const { source, target, targetHandle } = edgeData
  if (!source || !target) return { success: false, error: 'Edge ID or source/target required for delete_edge.' }
  const targetOp = getOp(target)
  if (!targetOp) return { success: false, error: `Target node ${target} not found.` }

  const targetFieldName = targetHandle?.split('.').pop() || 'in'
  const targetField = targetOp.inputs?.[targetFieldName] as any
  if (!targetField) return { success: false, error: `Target field ${targetFieldName} not found.` }

  for (const [subId] of targetField.subscriptions || []) {
    if (subId.includes(source)) {
      targetField.removeConnection(subId, 'value')
      return { success: true }
    }
  }
  return { success: false, error: `No connection found from ${source} to ${target}.` }
}

/** Apply an array of modifications to the noodles graph. */
export async function applyModifications(
  modifications: ProjectModification[],
  injectData: InjectDataFn,
  options: ApplyModificationsOptions = {},
): Promise<ApplyResult> {
  if (!modifications || !Array.isArray(modifications)) {
    return { success: false, appliedCount: 0, errors: ['No modifications provided'] }
  }

  const protectedNodes = new Set(options.protectedNodes ?? DEFAULT_PROTECTED_NODES)
  const colorInputs = new Set(options.colorInputs ?? DEFAULT_COLOR_INPUTS)
  const colorPresets = options.colorPresets ?? DEFAULT_COLOR_PRESETS

  const errors: string[] = []
  const warnings: string[] = []
  let appliedCount = 0

  for (const mod of modifications) {
    let result: { success: boolean; error?: string; warning?: string }

    switch (mod.type) {
      case 'update_node': {
        const inputs = ((mod.data.data as any)?.inputs || mod.data.data) as Record<string, unknown> | undefined
        result = applyUpdateNode(mod.data.id, { data: { inputs: inputs ?? {} } }, injectData, colorInputs, colorPresets)
        break
      }
      case 'delete_node':
        result = applyDeleteNode(mod.data.id, protectedNodes)
        break
      case 'add_edge':
        result = applyAddEdge(mod.data as any)
        break
      case 'delete_edge':
        result = applyDeleteEdge({ id: mod.data.id })
        break
      case 'add_node': {
        const asyncResult = await applyAddNode(mod.data as NoodlesNode)
        result = asyncResult
        break
      }
      default:
        result = { success: false, error: `Unknown modification type: ${(mod as any).type}` }
    }

    if (result.success) {
      appliedCount++
      if (result.warning) warnings.push(result.warning)
    } else if (result.error) {
      errors.push(result.error)
    }
  }

  if (appliedCount > 0) forceUpdate()

  return {
    success: errors.length === 0 && appliedCount > 0,
    appliedCount,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/** Parse modifications from tool call input */
export function parseToolCallModifications(toolCallInput: unknown): ProjectModification[] {
  if (!toolCallInput || typeof toolCallInput !== 'object') return []
  const modifications = (toolCallInput as Record<string, unknown>).modifications
  if (!Array.isArray(modifications)) return []
  return modifications.filter(
    (mod): mod is ProjectModification =>
      mod && typeof mod === 'object' && 'type' in mod && 'data' in mod && typeof (mod as any).data === 'object',
  )
}
