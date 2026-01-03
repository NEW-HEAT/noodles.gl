/**
 * Renderer utilities for creating custom visualization renderers
 * 
 * These utilities help integrate Noodles.gl visualizations with
 * external rendering pipelines for video export and multimedia content.
 */

import type { FrameData } from '../types'

/**
 * Options for creating a visualization renderer
 */
export interface VisualizationRendererOptions {
  /**
   * Canvas element to render to (optional, will be created if not provided)
   */
  canvas?: HTMLCanvasElement

  /**
   * Width of the rendering canvas
   */
  width?: number

  /**
   * Height of the rendering canvas
   */
  height?: number

  /**
   * Callback for each rendered frame
   */
  onFrame?: (canvas: HTMLCanvasElement, frameData: FrameData) => void

  /**
   * Callback when rendering completes
   */
  onComplete?: () => void
}

/**
 * Create a custom visualization renderer for external rendering pipelines
 * 
 * This utility creates a renderer that can capture frames from Noodles.gl
 * visualizations and integrate them with external multimedia systems.
 * 
 * @example
 * ```ts
 * const renderer = createVisualizationRenderer({
 *   width: 1920,
 *   height: 1080,
 *   onFrame: (canvas, frameData) => {
 *     // Add frame to video encoder
 *     videoEncoder.addFrame(canvas, frameData.timestamp);
 *   }
 * });
 * 
 * // Start rendering
 * renderer.start(noodlesInstance);
 * ```
 */
export function createVisualizationRenderer(
  options: VisualizationRendererOptions = {}
): VisualizationRenderer {
  const canvas = options.canvas ?? document.createElement('canvas')
  
  // Only set dimensions if not using a custom canvas or if dimensions are explicitly provided
  if (!options.canvas || options.width !== undefined) {
    canvas.width = options.width ?? 1920
  }
  if (!options.canvas || options.height !== undefined) {
    canvas.height = options.height ?? 1080
  }

  return new VisualizationRenderer(canvas, options)
}

/**
 * Visualization renderer class
 */
export class VisualizationRenderer {
  private canvas: HTMLCanvasElement
  private options: VisualizationRendererOptions
  private frameCount = 0
  private rendering = false

  constructor(canvas: HTMLCanvasElement, options: VisualizationRendererOptions) {
    this.canvas = canvas
    this.options = options
  }

  /**
   * Start rendering
   */
  start(): void {
    this.rendering = true
    this.frameCount = 0
  }

  /**
   * Stop rendering
   */
  stop(): void {
    this.rendering = false
    this.options.onComplete?.()
  }

  /**
   * Capture a single frame
   */
  captureFrame(timestamp: number, isLastFrame = false): void {
    if (!this.rendering) return

    const frameData: FrameData = {
      timestamp,
      frameNumber: this.frameCount++,
      isLastFrame,
    }

    this.options.onFrame?.(this.canvas, frameData)

    if (isLastFrame) {
      this.stop()
    }
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  /**
   * Check if currently rendering
   */
  isRendering(): boolean {
    return this.rendering
  }
}
