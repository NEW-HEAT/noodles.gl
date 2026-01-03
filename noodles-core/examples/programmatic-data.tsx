/**
 * Programmatic Data Example
 * 
 * This example demonstrates:
 * - Feeding data programmatically into the visualization
 * - Listening for data changes
 * - Updating visualization based on external data sources
 */

import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core'
import { useState, useMemo, useEffect } from 'react'

// Sample project that expects programmatic data
const dataProject = {
  version: 6,
  nodes: [
    {
      id: '/data-input',
      type: 'GraphInputOp',
      position: { x: 100, y: 100 },
      data: {
        inputs: {
          data: null, // Will be set programmatically
        },
      },
    },
    {
      id: '/scatter-layer',
      type: 'ScatterplotLayerOp',
      position: { x: 400, y: 100 },
      data: {
        inputs: {
          data: { ref: '/data-input' },
          getPosition: 'd => [d.lng, d.lat]',
          getRadius: 'd.value * 10',
          getFillColor: '[255, 140, 0]',
        },
      },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
}

// Generate sample data points
function generateDataPoints(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    lng: -122 + Math.random() * 10,
    lat: 37 + Math.random() * 5,
    value: Math.random() * 100,
    timestamp: Date.now(),
  }))
}

/**
 * ProgrammaticData component
 * 
 * Demonstrates programmatic data feeding and event listening.
 */
export function ProgrammaticData() {
  const [dataPoints, setDataPoints] = useState(() => generateDataPoints(50))
  const [updateCount, setUpdateCount] = useState(0)

  // Create a NoodlesGL instance
  const noodles = useMemo(
    () =>
      NoodlesGL.create({
        editorVisible: false,
        project: dataProject,
        layoutMode: 'output-on-top',
      }),
    []
  )

  // Listen for render events
  useEffect(() => {
    const handleRender = (frameData: unknown) => {
      console.log('Frame rendered:', frameData)
    }

    noodles.on('render', handleRender)

    return () => {
      noodles.off('render', handleRender)
    }
  }, [noodles])

  // Feed data to the visualization
  useEffect(() => {
    noodles.setData('/data-input', dataPoints)
  }, [noodles, dataPoints])

  // Update data periodically
  const handleUpdateData = () => {
    const newData = generateDataPoints(50)
    setDataPoints(newData)
    setUpdateCount(prev => prev + 1)
  }

  const handleAddPoint = () => {
    setDataPoints(prev => [
      ...prev,
      {
        id: prev.length,
        lng: -122 + Math.random() * 10,
        lat: 37 + Math.random() * 5,
        value: Math.random() * 100,
        timestamp: Date.now(),
      },
    ])
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '300px',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>
          Programmatic Data Control
        </h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Data Points:</strong> {dataPoints.length}
          </p>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Updates:</strong> {updateCount}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
          <button
            onClick={handleUpdateData}
            style={{
              padding: '0.5rem 1rem',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Regenerate All Data
          </button>
          <button
            onClick={handleAddPoint}
            style={{
              padding: '0.5rem 1rem',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Add One Point
          </button>
        </div>

        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
          This example feeds data programmatically into the visualization.
          Click the buttons to update the data and see the visualization react.
        </p>
      </div>

      {/* Visualization */}
      <NoodlesGLComponent instance={noodles} />
    </div>
  )
}

export default ProgrammaticData
