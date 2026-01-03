/**
 * Toggle Editor Example
 * 
 * This example demonstrates:
 * - Starting with the editor hidden
 * - Toggling editor visibility on demand
 * - Maintaining visualization state during toggle
 */

import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core'
import { useState, useMemo } from 'react'

// Sample project (same as simple-viewer for consistency)
const sampleProject = {
  version: 6,
  nodes: [
    {
      id: '/data-source',
      type: 'FileOp',
      position: { x: 100, y: 100 },
      data: {
        inputs: {
          url: '@/sample-data.geojson',
          format: 'geojson',
        },
      },
    },
    {
      id: '/scatter-layer',
      type: 'ScatterplotLayerOp',
      position: { x: 400, y: 100 },
      data: {
        inputs: {
          data: { ref: '/data-source' },
          getPosition: 'd => [d.longitude, d.latitude]',
          getRadius: 100,
          getFillColor: '[255, 0, 0]',
        },
      },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
}

/**
 * ToggleEditor component
 * 
 * Demonstrates how to toggle the node editor visibility
 * while keeping the visualization running.
 */
export function ToggleEditor() {
  const [showEditor, setShowEditor] = useState(false)

  // Create a NoodlesGL instance with the editor initially hidden
  const noodles = useMemo(
    () =>
      NoodlesGL.create({
        editorVisible: false,
        project: sampleProject,
        layoutMode: 'split',
      }),
    []
  )

  // Handle toggle
  const handleToggle = () => {
    const newState = !showEditor
    setShowEditor(newState)
    noodles.setEditorVisibility(newState)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>Controls</h2>
        <button
          onClick={handleToggle}
          style={{
            padding: '0.5rem 1rem',
            background: showEditor ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          {showEditor ? 'Hide Editor' : 'Show Editor'}
        </button>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
          {showEditor
            ? 'Advanced editing enabled'
            : 'Simple mode (editor hidden)'}
        </p>
      </div>

      {/* Visualization */}
      <NoodlesGLComponent instance={noodles} />
    </div>
  )
}

export default ToggleEditor
