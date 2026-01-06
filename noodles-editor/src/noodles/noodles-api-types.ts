/**
 * Core types for the Noodles.gl programmatic API
 */

import type { DeckProps, MapViewState } from '@deck.gl/core'
import type { IProject, ISheet } from '@theatre/core'
import type { MapProps } from 'react-map-gl/maplibre'

/**
 * Project configuration that can be loaded into Noodles.gl
 */
export interface NoodlesProject {
  version: number
  nodes: unknown[]
  edges: Array<{ id: string, source: string, target: string, sourceHandle: string, targetHandle: string, [key: string]: any }>
  viewport?: { x: number; y: number; zoom: number }
  timeline?: Record<string, unknown>
  editorSettings?: {
    layoutMode?: 'split' | 'noodles-on-top' | 'output-on-top'
    showOverlay?: boolean
  }
}

/**
 * Configuration options for creating a Noodles.gl instance
 */
export interface NoodlesGLOptions {
  /**
   * Whether the node editor should be visible. Default: true
   */
  editorVisible?: boolean

  /**
   * Initial project to load
   */
  project?: NoodlesProject

  /**
   * Project name (for resolving @/ file paths)
   */
  projectName?: string

  /**
   * Rendering mode
   * - 'standalone': Normal rendering in the DOM
   * - 'external': Use an external rendering context for unified multimedia export
   */
  renderMode?: 'standalone' | 'external'

  /**
   * Callback for external rendering mode
   * Called with canvas and frame data for each rendered frame
   */
  onFrame?: (canvas: HTMLCanvasElement, frameData: FrameData) => void

  /**
   * Enable advanced editing controls. Default: false
   */
  advancedControls?: boolean

  /**
   * Initial layout mode for the editor
   */
  layoutMode?: 'split' | 'noodles-on-top' | 'output-on-top'

  /**
   * Whether to show the overlay (node editor on top of visualization)
   */
  showOverlay?: boolean
}

/**
 * Frame data provided during rendering
 */
export interface FrameData {
  /**
   * Current timeline timestamp in seconds
   */
  timestamp: number

  /**
   * Frame number
   */
  frameNumber: number

  /**
   * Whether this is the last frame
   */
  isLastFrame: boolean
}

/**
 * Event types that can be emitted by NoodlesGL
 */
export type NoodlesGLEvent = 'render' | 'data-changed' | 'project-loaded' | 'timeline-changed' | 'initialized'

/**
 * Event listener callback type
 */
export type EventListener = (...args: unknown[]) => void

/**
 * Visualization properties returned from the core system
 */
export interface VisualizationProps {
  deckProps: Partial<DeckProps & { viewState: MapViewState }>
  mapProps?: MapProps & MapViewState
  project: IProject
  sheet: ISheet
}

/**
 * Internal state managed by NoodlesGL
 */
export interface NoodlesGLState {
  editorVisible: boolean
  project: NoodlesProject | null
  projectName?: string
  renderMode: 'standalone' | 'external'
  layoutMode: 'split' | 'noodles-on-top' | 'output-on-top'
  showOverlay: boolean
  advancedControls: boolean
  currentTime: number
  playing: boolean
}

/**
 * Operator - Basic operator interface for programmatic manipulation
 */
export interface Operator {
  id: string
  inputs: Record<string, any>
  outputs: Record<string, any>
  execute?: (inputs: any) => any
}
