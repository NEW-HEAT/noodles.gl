/**
 * Resolve Date Strings in Modifications
 *
 * When the AI sets timePreset: "custom" with `relative`, `startDate`, or `endDate`
 * strings instead of numeric timestamps, compute the actual timestamps.
 */

import { parseRelativeDate, calculateDateRange } from './date-tools'
import type { ProjectModification } from './graph-types'

/** Resolve date strings in /data-request modifications to numeric timestamps. */
export function resolveDataRequestTimestamps(mods: ProjectModification[]): ProjectModification[] {
  return mods.map((mod) => {
    if (mod.type !== 'update_node' || mod.data?.id !== '/data-request') return mod

    const nodeData = mod.data.data as Record<string, unknown> | undefined
    if (!nodeData) return mod

    const hasInputsWrapper = nodeData.inputs && typeof nodeData.inputs === 'object'
    const inputs = (hasInputsWrapper ? nodeData.inputs : nodeData) as Record<string, unknown>
    if (!inputs || inputs.timePreset !== 'custom') return mod

    if (typeof inputs.customStartTime === 'number' && inputs.customStartTime > 0 &&
        typeof inputs.customEndTime === 'number' && inputs.customEndTime > 0) {
      return mod
    }

    try {
      const relative = inputs.relative as string | undefined
      const startDate = inputs.startDate as string | undefined
      const endDate = inputs.endDate as string | undefined

      let result
      if (relative) result = parseRelativeDate(relative)
      else if (startDate && endDate) result = calculateDateRange(startDate, endDate)
      else return mod

      const newInputs = { ...inputs }
      newInputs.customStartTime = result.customStartTime
      newInputs.customEndTime = result.customEndTime
      delete newInputs.relative
      delete newInputs.startDate
      delete newInputs.endDate

      return { ...mod, data: { ...mod.data, data: { inputs: newInputs } } }
    } catch (err) {
      console.warn('[resolve-timestamps] Failed to resolve date timestamps:', err)
      return mod
    }
  })
}
