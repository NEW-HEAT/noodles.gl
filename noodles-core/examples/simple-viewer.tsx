/**
 * Simple Viewer Example
 * 
 * This example demonstrates the most basic usage of @noodles-gl/core:
 * - Create a visualization with the editor hidden
 * - Load a project
 * - Render the map output
 */

import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core'
import { useMemo } from 'react'

// Sample project configuration
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
    {
      id: '/renderer',
      type: 'DeckRendererOp',
      position: { x: 700, y: 100 },
      data: {
        inputs: {
          layers: { ref: '/scatter-layer' },
        },
      },
    },
  ],
  edges: [
    {
      id: '/data-source.out.data->/scatter-layer.par.data',
      source: '/data-source',
      target: '/scatter-layer',
      sourceHandle: 'out.data',
      targetHandle: 'par.data',
    },
    {
      id: '/scatter-layer.out.layer->/renderer.par.layers',
      source: '/scatter-layer',
      target: '/renderer',
      sourceHandle: 'out.layer',
      targetHandle: 'par.layers',
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
}

/**
 * SimpleViewer component
 * 
 * Renders a Noodles.gl visualization with the editor hidden,
 * showing only the map output.
 */
export function SimpleViewer() {
  // Create a NoodlesGL instance with the editor hidden
  const noodles = useMemo(
    () =>
      NoodlesGL.create({
        editorVisible: false,
        project: sampleProject,
        layoutMode: 'output-on-top',
      }),
    []
  )

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <h1 style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000 }}>
        Simple Viewer (Editor Hidden)
      </h1>
      <NoodlesGLComponent instance={noodles} />
    </div>
  )
}

export default SimpleViewer
