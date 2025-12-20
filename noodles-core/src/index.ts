/**
 * @noodles-gl/core - Programmatic API for Noodles.gl
 * 
 * This package provides a programmatic interface for integrating Noodles.gl
 * geospatial visualizations into external applications, with support for:
 * 
 * - Toggling node editor visibility
 * - Programmatic data input
 * - External rendering synchronization
 * - Event-driven architecture
 */

export { NoodlesGL } from './noodles-gl'
export { NoodlesGLComponent } from './noodles-gl-component'
export type {
  NoodlesGLComponentProps,
  VisualizationRenderProps,
} from './noodles-gl-component'
export type {
  EventListener,
  FrameData,
  NoodlesGLEvent,
  NoodlesGLOptions,
  NoodlesGLState,
  NoodlesProject,
  VisualizationProps,
} from './types'

// Re-export useful utilities from noodles-editor
// These will be implemented as the integration deepens
export { createVisualizationRenderer } from './utils/renderer'
export { createHeadlessVisualization } from './utils/headless'
