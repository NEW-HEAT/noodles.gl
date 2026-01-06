/**
 * SimpleModeControls - A minimal control panel for simple mode
 *
 * Provides programmatic access to operator values without the full editor.
 * Demonstrates adding operators dynamically to the graph.
 */

import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { SliceOp, type Operator, type IOperator } from '../operators'
import { useOperatorStore, useNestingStore } from '../store'
import { edgeId } from '../utils/id-utils'

interface LayerControl {
  id: string
  name: string
  type: 'scatterplot' | 'arc' | 'path' | 'polygon' | 'icon' | 'text' | 'heatmap' | 'other'
  hasOpacity?: boolean
  hasRadius?: boolean
  hasWidth?: boolean
}

interface ColorControl {
  id: string
  name: string
  color: string
}

interface DataConnection {
  layerId: string
  edgeId: string
}

const LAYER_TYPE_MAP: Record<string, LayerControl['type']> = {
  ScatterplotLayerOp: 'scatterplot',
  ArcLayerOp: 'arc',
  PathLayerOp: 'path',
  PolygonLayerOp: 'polygon',
  IconLayerOp: 'icon',
  TextLayerOp: 'text',
  HeatmapLayerOp: 'heatmap',
}

function getLayerTypeInfo(type: string): { layerType: LayerControl['type']; hasOpacity: boolean; hasRadius: boolean; hasWidth: boolean } {
  const layerType = LAYER_TYPE_MAP[type] || 'other'
  return {
    layerType,
    hasOpacity: true,
    hasRadius: ['scatterplot', 'icon'].includes(layerType),
    hasWidth: ['arc', 'path'].includes(layerType),
  }
}

function formatOpName(id: string): string {
  return id.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const SLICE_OP_ID = '/data-filter'

export function SimpleModeControls() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [layers, setLayers] = useState<LayerControl[]>([])
  const [colors, setColors] = useState<ColorControl[]>([])
  const [dataSourceId, setDataSourceId] = useState<string | null>(null)
  const [dataSourcePosition, setDataSourcePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dataCount, setDataCount] = useState(0)
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [filterLimit, setFilterLimit] = useState(500)
  const [dataConnections, setDataConnections] = useState<DataConnection[]>([])

  const operators = useOperatorStore(state => state.operators)
  const setOp = useOperatorStore(state => state.setOp)
  const deleteOp = useOperatorStore(state => state.deleteOp)
  const currentContainerId = useNestingStore(state => state.currentContainerId)

  const { addNodes, addEdges, deleteElements, getNodes, getEdges } = useReactFlow()

  // Detect controllable operators and data connections
  useEffect(() => {
    const detectedLayers: LayerControl[] = []
    const detectedColors: ColorControl[] = []
    const detectedConnections: DataConnection[] = []
    let foundDataSource: string | null = null
    let foundDataCount = 0
    let foundDataSourcePosition = { x: 0, y: 0 }

    // Check if slice op already exists
    const sliceExists = operators.has(SLICE_OP_ID)
    setFilterEnabled(sliceExists)

    operators.forEach((op, id) => {
      const typeName = op.constructor.name

      // Find FileOp as data source
      if (typeName === 'FileOp' && !id.startsWith('/_')) {
        const dataOutput = (op.outputs as any)?.data?.value
        if (Array.isArray(dataOutput) && dataOutput.length > 0) {
          foundDataSource = id
          foundDataCount = dataOutput.length
          // Get position from React Flow nodes
          const nodes = getNodes()
          const node = nodes.find(n => n.id === id)
          if (node) {
            foundDataSourcePosition = { x: node.position.x + 300, y: node.position.y }
          }
        }
      }

      // Detect layer operators and their data connections
      if (typeName.includes('LayerOp') && !id.startsWith('/_')) {
        const info = getLayerTypeInfo(typeName)
        detectedLayers.push({
          id,
          name: formatOpName(id),
          type: info.layerType,
          hasOpacity: info.hasOpacity,
          hasRadius: info.hasRadius,
          hasWidth: info.hasWidth,
        })

        // Check subscriptions for data connections
        const dataInput = (op.inputs as any)?.data
        if (dataInput?.subscriptions && foundDataSource) {
          for (const [subEdgeId] of dataInput.subscriptions) {
            // Check if connected to data source or slice op
            if (subEdgeId.startsWith(foundDataSource + '.') || subEdgeId.startsWith(SLICE_OP_ID + '.')) {
              detectedConnections.push({ layerId: id, edgeId: subEdgeId })
            }
          }
        }
      }

      // Detect color operators
      if (typeName === 'ColorOp' && !id.startsWith('/_')) {
        const colorValue = (op.inputs as any)?.color?.value || '#ffffff'
        detectedColors.push({
          id,
          name: formatOpName(id),
          color: typeof colorValue === 'string' ? colorValue : '#ffffff',
        })
      }
    })

    setLayers(detectedLayers)
    setColors(detectedColors)
    setDataSourceId(foundDataSource)
    setDataSourcePosition(foundDataSourcePosition)
    setDataCount(foundDataCount)
    setDataConnections(detectedConnections)
  }, [operators, getNodes])

  const updateOperatorInput = useCallback((opId: string, inputName: string, value: unknown) => {
    const op = useOperatorStore.getState().operators.get(opId)
    if (op?.inputs && inputName in op.inputs) {
      ;(op.inputs as Record<string, { setValue: (v: unknown) => void }>)[inputName].setValue(value)
    }
  }, [])

  const getOperatorInputValue = useCallback((opId: string, inputName: string): unknown => {
    const op = useOperatorStore.getState().operators.get(opId)
    if (op?.inputs && inputName in op.inputs) {
      return (op.inputs as Record<string, { value: unknown }>)[inputName].value
    }
    return undefined
  }, [])

  // Add a SliceOp to the graph
  const addFilterOperator = useCallback(() => {
    if (!dataSourceId) return

    const sourceOp = useOperatorStore.getState().operators.get(dataSourceId)
    if (!sourceOp) return

    console.log('Adding filter operator between', dataSourceId, 'and layers')

    // 1. Create the SliceOp instance
    const sliceOp = new SliceOp(SLICE_OP_ID)
    sliceOp.inputs.start.setValue(0)
    sliceOp.inputs.end.setValue(filterLimit)

    // 2. Add to operator store
    setOp(SLICE_OP_ID, sliceOp as unknown as Operator<IOperator>)

    // 3. Set up reactive execution (must be called before connections are made)
    sliceOp.createListeners()

    // 4. Add node to React Flow graph
    const sliceNode = {
      id: SLICE_OP_ID,
      type: 'SliceOp',
      position: dataSourcePosition,
      data: {
        inputs: {
          start: 0,
          end: filterLimit,
        },
      },
    }
    addNodes([sliceNode])

    // 5. Create edge from data source to slice
    const sourceToSliceEdge = {
      id: edgeId({
        source: dataSourceId,
        sourceHandle: 'out.data',
        target: SLICE_OP_ID,
        targetHandle: 'par.data',
      }),
      source: dataSourceId,
      sourceHandle: 'out.data',
      target: SLICE_OP_ID,
      targetHandle: 'par.data',
    }

    // 6. Connect data source output to slice input (reactive)
    const sourceOutput = (sourceOp.outputs as any)?.data
    if (sourceOutput) {
      sliceOp.inputs.data.addConnection(sourceToSliceEdge.id, sourceOutput, 'value')
    }

    // 7. Create edges from slice to all layers and rewire connections
    const newEdges = [sourceToSliceEdge]
    const edgesToDelete: string[] = []

    for (const { layerId, edgeId: oldEdgeId } of dataConnections) {
      const layerOp = useOperatorStore.getState().operators.get(layerId)
      if (!layerOp) continue

      const dataInput = (layerOp.inputs as any)?.data
      if (!dataInput) continue

      // Remove old connection from data source
      dataInput.removeConnection(oldEdgeId, 'value')
      edgesToDelete.push(oldEdgeId)

      // Create new edge from slice to layer
      const sliceToLayerEdge = {
        id: edgeId({
          source: SLICE_OP_ID,
          sourceHandle: 'out.data',
          target: layerId,
          targetHandle: 'par.data',
        }),
        source: SLICE_OP_ID,
        sourceHandle: 'out.data',
        target: layerId,
        targetHandle: 'par.data',
      }
      newEdges.push(sliceToLayerEdge)

      // Connect slice output to layer input (reactive)
      dataInput.addConnection(sliceToLayerEdge.id, sliceOp.outputs.data, 'value')
    }

    // 8. Update React Flow edges
    deleteElements({ edges: edgesToDelete.map(id => ({ id })) })
    addEdges(newEdges)

    setFilterEnabled(true)
    console.log('Filter operator added successfully')
  }, [dataSourceId, dataSourcePosition, filterLimit, dataConnections, setOp, addNodes, addEdges, deleteElements])

  // Remove the SliceOp from the graph
  const removeFilterOperator = useCallback(() => {
    if (!dataSourceId) return

    const sourceOp = useOperatorStore.getState().operators.get(dataSourceId)
    const sliceOp = useOperatorStore.getState().operators.get(SLICE_OP_ID)
    if (!sourceOp || !sliceOp) return

    console.log('Removing filter operator')

    const newEdges: any[] = []
    const edgesToDelete: string[] = []

    // First pass: collect all layers that need to be reconnected
    const layersToReconnect: Array<{ layerId: string; dataInput: any; oldEdgeId: string }> = []

    operators.forEach((op, layerId) => {
      if (!op.constructor.name.includes('LayerOp')) return

      const dataInput = (op.inputs as any)?.data
      if (!dataInput?.subscriptions) return

      // Collect connections to slice (don't modify while iterating)
      for (const [subEdgeId] of dataInput.subscriptions) {
        if (subEdgeId.startsWith(SLICE_OP_ID + '.')) {
          layersToReconnect.push({ layerId, dataInput, oldEdgeId: subEdgeId })
        }
      }
    })

    // Second pass: reconnect each layer to the data source
    const sourceOutput = (sourceOp.outputs as any)?.data
    const existingEdges = getEdges()
    const existingEdgeIds = new Set(existingEdges.map(e => e.id))

    for (const { layerId, dataInput, oldEdgeId } of layersToReconnect) {
      // Create new edge from data source directly to layer
      const directEdgeId = edgeId({
        source: dataSourceId,
        sourceHandle: 'out.data',
        target: layerId,
        targetHandle: 'par.data',
      })

      // Only add edge if it doesn't already exist
      if (!existingEdgeIds.has(directEdgeId)) {
        const directEdge = {
          id: directEdgeId,
          source: dataSourceId,
          sourceHandle: 'out.data',
          target: layerId,
          targetHandle: 'par.data',
        }
        newEdges.push(directEdge)
      }

      // Remove the old slice connection
      dataInput.removeConnection(oldEdgeId, 'reference')
      edgesToDelete.push(oldEdgeId)

      // Add the new direct connection to data source (reactive subscription)
      // Check if subscription already exists to avoid duplicates
      if (sourceOutput && !dataInput.subscriptions.has(directEdgeId)) {
        dataInput.addConnection(directEdgeId, sourceOutput, 'value')
      }
    }

    // Also delete the edge from data source to slice
    edgesToDelete.push(edgeId({
      source: dataSourceId,
      sourceHandle: 'out.data',
      target: SLICE_OP_ID,
      targetHandle: 'par.data',
    }))

    // Update React Flow
    deleteElements({
      nodes: [{ id: SLICE_OP_ID }],
      edges: edgesToDelete.map(id => ({ id }))
    })
    addEdges(newEdges)

    // Dispose of operator (cleans up internal RxJS subscriptions) and remove from store
    sliceOp.dispose()
    deleteOp(SLICE_OP_ID)

    setFilterEnabled(false)
    console.log('Filter operator removed')
  }, [dataSourceId, operators, deleteOp, addEdges, deleteElements, getEdges])

  // Update filter limit
  const updateFilterLimit = useCallback((limit: number) => {
    setFilterLimit(limit)
    if (filterEnabled) {
      updateOperatorInput(SLICE_OP_ID, 'end', limit)
    }
  }, [filterEnabled, updateOperatorInput])

  if (layers.length === 0 && colors.length === 0 && !dataSourceId) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 10000,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
      }}
    >
      {!isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'white',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.85)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'
          }}
          title="Show Controls"
        >
          <i className="pi pi-sliders-h" />
          Controls
        </button>
      )}

      {isExpanded && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '220px',
            maxWidth: '280px',
            maxHeight: '450px',
            overflowY: 'auto',
            color: 'white',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Controls</span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <i className="pi pi-times" style={{ fontSize: '12px' }} />
            </button>
          </div>

          {/* Data Filter Section */}
          {dataSourceId && dataCount > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <SectionHeader>Data Filter</SectionHeader>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '8px' }}>
                {filterEnabled ? `${filterLimit.toLocaleString()} of ` : ''}{dataCount.toLocaleString()} records
                {dataConnections.length > 0 && !filterEnabled && ` • ${dataConnections.length} layer${dataConnections.length > 1 ? 's' : ''}`}
              </div>

              {!filterEnabled ? (
                <button
                  type="button"
                  onClick={addFilterOperator}
                  disabled={dataConnections.length === 0}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: dataConnections.length > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                    border: `1px solid ${dataConnections.length > 0 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(100, 100, 100, 0.3)'}`,
                    borderRadius: '4px',
                    color: dataConnections.length > 0 ? '#93c5fd' : '#888',
                    cursor: dataConnections.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (dataConnections.length > 0) {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (dataConnections.length > 0) {
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
                    }
                  }}
                >
                  <i className="pi pi-plus" style={{ fontSize: '10px' }} />
                  Add Filter Node
                </button>
              ) : (
                <div>
                  <SliderInput
                    label="Show first"
                    value={filterLimit}
                    min={10}
                    max={Math.min(dataCount, 10000)}
                    step={10}
                    onChange={updateFilterLimit}
                    suffix=" rows"
                  />
                  <button
                    type="button"
                    onClick={removeFilterOperator}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '4px',
                      color: '#fca5a5',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    Remove Filter Node
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Colors Section */}
          {colors.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <SectionHeader>Colors</SectionHeader>
              {colors.map(color => (
                <ColorInput
                  key={color.id}
                  label={color.name}
                  value={getOperatorInputValue(color.id, 'color') as string || color.color}
                  onChange={value => updateOperatorInput(color.id, 'color', value)}
                />
              ))}
            </div>
          )}

          {/* Layers Section */}
          {layers.length > 0 && (
            <div>
              <SectionHeader>Layers</SectionHeader>
              {layers.map(layer => (
                <LayerControls
                  key={layer.id}
                  layer={layer}
                  getValue={(input) => getOperatorInputValue(layer.id, input)}
                  setValue={(input, value) => updateOperatorInput(layer.id, input, value)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '11px',
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '8px',
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </div>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const hexColor = value.slice(0, 7)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
      <span style={{ fontSize: '12px' }}>{label}</span>
      <input
        type="color"
        value={hexColor}
        onChange={e => onChange(e.target.value + 'ff')}
        style={{
          width: '32px',
          height: '24px',
          padding: 0,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '4px',
          cursor: 'pointer',
          background: 'transparent',
        }}
      />
    </div>
  )
}

function LayerControls({
  layer,
  getValue,
  setValue,
}: {
  layer: LayerControl
  getValue: (input: string) => unknown
  setValue: (input: string, value: unknown) => void
}) {
  const opacity = (getValue('opacity') as number) ?? 1
  const radius = (getValue('getRadius') as number) ?? 10
  const width = (getValue('getWidth') as number) ?? 1
  const visible = (getValue('visible') as boolean) ?? true

  return (
    <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 500 }}>{layer.name}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={visible}
            onChange={e => setValue('visible', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>Visible</span>
        </label>
      </div>

      {layer.hasOpacity && (
        <SliderInput label="Opacity" value={opacity} min={0} max={1} step={0.05} onChange={value => setValue('opacity', value)} />
      )}
      {layer.hasRadius && (
        <SliderInput label="Radius" value={radius} min={1} max={100} step={1} onChange={value => setValue('getRadius', value)} />
      )}
      {layer.hasWidth && (
        <SliderInput label="Width" value={width} min={0.5} max={20} step={0.5} onChange={value => setValue('getWidth', value)} />
      )}
    </div>
  )
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '',
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}) {
  const displayValue = step < 1 ? value.toFixed(2) : Math.round(value).toLocaleString()

  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '2px' }}>
        <span>{label}</span>
        <span>{displayValue}{suffix}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: '4px', cursor: 'pointer', accentColor: '#3b82f6' }}
      />
    </div>
  )
}
