/**
 * Headless visualization utilities
 * 
 * These utilities allow running Noodles.gl visualizations without
 * the full editor UI, suitable for server-side rendering or
 * simple embedded visualizations.
 */

import type { NoodlesProject, VisualizationProps } from '../types'

/**
 * Options for creating a headless visualization
 */
export interface HeadlessVisualizationOptions {
  /**
   * Project to load
   */
  project: NoodlesProject

  /**
   * Data to feed into operators
   */
  data?: Record<string, unknown>

  /**
   * Current timeline position
   */
  time?: number

  /**
   * Callback when visualization is ready
   */
  onReady?: (props: VisualizationProps) => void
}

/**
 * Create a headless visualization (without editor UI)
 * 
 * This utility creates a minimal Noodles.gl visualization that only
 * includes the map output and data processing, without the node editor.
 * Perfect for embedding in dashboards or exporting to static formats.
 * 
 * @example
 * ```ts
 * const viz = createHeadlessVisualization({
 *   project: myProject,
 *   data: {
 *     '/data-loader': myGeoJsonData
 *   },
 *   onReady: (props) => {
 *     console.log('Visualization ready:', props.deckProps);
 *   }
 * });
 * ```
 */
export function createHeadlessVisualization(
  options: HeadlessVisualizationOptions
): HeadlessVisualization {
  return new HeadlessVisualization(options)
}

/**
 * Headless visualization class
 */
export class HeadlessVisualization {
  private options: HeadlessVisualizationOptions
  private ready = false
  private visualizationProps: VisualizationProps | null = null

  constructor(options: HeadlessVisualizationOptions) {
    this.options = options
    this.initialize()
  }

  /**
   * Initialize the visualization
   */
  private async initialize(): Promise<void> {
    // Load project
    // Set up operators
    // Apply data
    // This will be implemented to interact with the actual Noodles system

    this.ready = true
    if (this.visualizationProps) {
      this.options.onReady?.(this.visualizationProps)
    }
  }

  /**
   * Update data for a specific operator
   */
  setData(_operatorId: string, _data: unknown): void {
    // This will update the operator's data
  }

  /**
   * Get the current visualization properties
   */
  getVisualizationProps(): VisualizationProps | null {
    return this.visualizationProps
  }

  /**
   * Seek to a specific time
   */
  seekTo(_time: number): void {
    // Update timeline position
  }

  /**
   * Check if the visualization is ready
   */
  isReady(): boolean {
    return this.ready
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clean up operators, subscriptions, etc.
  }
}
