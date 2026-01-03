/**
 * External Rendering Example
 * 
 * This example demonstrates:
 * - Integration with external multimedia rendering pipelines
 * - Frame synchronization for video export
 * - Using Noodles.gl in a unified rendering system
 */

import { NoodlesGL, createVisualizationRenderer } from '@noodles-gl/core'
import { useState, useMemo, useEffect, useRef } from 'react'

// Sample project for rendering
const renderProject = {
  version: 6,
  nodes: [
    {
      id: '/animated-layer',
      type: 'ScatterplotLayerOp',
      position: { x: 100, y: 100 },
      data: {
        inputs: {
          data: [
            { lng: -122.4, lat: 37.8, size: 50 },
            { lng: -122.3, lat: 37.7, size: 75 },
            { lng: -122.5, lat: 37.9, size: 100 },
          ],
          getPosition: 'd => [d.lng, d.lat]',
          getRadius: 'd.size',
          getFillColor: '[255, 100, 0, 200]',
        },
      },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  timeline: {
    duration: 5, // 5 seconds
  },
}

/**
 * ExternalRendering component
 * 
 * Demonstrates integration with external rendering systems
 * for unified multimedia export.
 */
export function ExternalRendering() {
  const [isRendering, setIsRendering] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [totalFrames] = useState(150) // 5 seconds at 30fps
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Create a NoodlesGL instance in external rendering mode
  const noodles = useMemo(() => {
    const renderer = createVisualizationRenderer({
      width: 1920,
      height: 1080,
      onFrame: (canvas, frameData) => {
        console.log(`Frame ${frameData.frameNumber} rendered at ${frameData.timestamp}s`)
        setFrameCount(frameData.frameNumber)
        
        // In a real application, you would:
        // 1. Add this frame to a video encoder
        // 2. Combine with other multimedia elements
        // 3. Write to output file
        // Example:
        // videoEncoder.addFrame(canvas, frameData.timestamp)
      },
      onComplete: () => {
        console.log('Rendering complete!')
        setIsRendering(false)
      },
    })

    return NoodlesGL.create({
      editorVisible: false,
      project: renderProject,
      renderMode: 'external',
      onFrame: renderer.captureFrame.bind(renderer),
    })
  }, [])

  // Start rendering
  const handleStartRender = () => {
    setIsRendering(true)
    setFrameCount(0)

    // Simulate frame-by-frame rendering
    const fps = 30
    const duration = 5 // seconds
    const totalFrames = fps * duration

    let currentFrame = 0
    const renderInterval = setInterval(() => {
      const timestamp = currentFrame / fps
      noodles.seekTo(timestamp)
      noodles.renderFrame({
        timestamp,
        frameNumber: currentFrame,
        isLastFrame: currentFrame >= totalFrames - 1,
      })

      currentFrame++
      if (currentFrame >= totalFrames) {
        clearInterval(renderInterval)
      }
    }, 1000 / fps)
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
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '350px',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>
          External Rendering System
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Status:</strong> {isRendering ? 'Rendering...' : 'Ready'}
          </p>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Progress:</strong> {frameCount} / {totalFrames} frames
          </p>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: '#eee',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(frameCount / totalFrames) * 100}%`,
                height: '100%',
                background: '#4CAF50',
                transition: 'width 0.1s',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleStartRender}
          disabled={isRendering}
          style={{
            padding: '0.75rem 1.5rem',
            background: isRendering ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRendering ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            width: '100%',
          }}
        >
          {isRendering ? 'Rendering...' : 'Start Render'}
        </button>

        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '0.85rem',
          }}
        >
          <strong>Integration Points:</strong>
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
            <li>Frame-by-frame rendering</li>
            <li>Timeline synchronization</li>
            <li>External canvas output</li>
            <li>Video encoder integration</li>
          </ul>
        </div>

        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
          This example shows how to integrate Noodles.gl with external
          multimedia rendering systems for unified video export.
        </p>
      </div>

      {/* Preview Canvas (hidden in real implementation) */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'none',
          width: 1920,
          height: 1080,
        }}
      />
    </div>
  )
}

export default ExternalRendering
