/**
 * Main NoodlesGL class - Programmatic API for Noodles.gl
 * 
 * This class provides a programmatic interface to create and control
 * Noodles.gl visualizations without directly using React components.
 */

import type {
  EventListener,
  FrameData,
  NoodlesGLEvent,
  NoodlesGLOptions,
  NoodlesGLState,
  NoodlesProject,
} from './types'

/**
 * NoodlesGL - Main API class for programmatic control
 * 
 * @example
 * ```tsx
 * // Create with hidden editor
 * const noodles = NoodlesGL.create({ editorVisible: false });
 * 
 * // Toggle editor visibility
 * noodles.setEditorVisibility(true);
 * 
 * // Set data programmatically
 * noodles.setData('/data-loader', myData);
 * 
 * // Listen for events
 * noodles.on('render', (frame) => console.log('Rendered:', frame));
 * ```
 */
export class NoodlesGL {
  private state: NoodlesGLState
  private eventListeners: Map<NoodlesGLEvent, Set<EventListener>>
  private onFrameCallback?: (canvas: HTMLCanvasElement, frameData: FrameData) => void

  private constructor(options: NoodlesGLOptions = {}) {
    this.state = {
      editorVisible: options.editorVisible ?? true,
      project: options.project ?? null,
      renderMode: options.renderMode ?? 'standalone',
      layoutMode: options.layoutMode ?? 'split',
      showOverlay: options.showOverlay ?? true,
      advancedControls: options.advancedControls ?? false,
      currentTime: 0,
      playing: false,
    }

    this.eventListeners = new Map()
    this.onFrameCallback = options.onFrame
  }

  /**
   * Create a new NoodlesGL instance
   */
  static create(options?: NoodlesGLOptions): NoodlesGL {
    return new NoodlesGL(options)
  }

  /**
   * Get the current state
   */
  getState(): Readonly<NoodlesGLState> {
    return { ...this.state }
  }

  /**
   * Set editor visibility
   */
  setEditorVisibility(visible: boolean): void {
    this.state.editorVisible = visible
    this.emit('data-changed', { editorVisible: visible })
  }

  /**
   * Load a project
   */
  async loadProject(project: NoodlesProject): Promise<void> {
    this.state.project = project
    this.emit('project-loaded', project)
  }

  /**
   * Set data for a specific operator
   */
  setData(operatorId: string, data: unknown): void {
    // This will be implemented to interact with the operator store
    this.emit('data-changed', { operatorId, data })
  }

  /**
   * Get output data from an operator
   */
  getData(operatorId: string): unknown {
    // This will be implemented to read from the operator store
    return null
  }

  /**
   * Seek to a specific time in the timeline
   */
  seekTo(time: number): void {
    this.state.currentTime = time
    this.emit('timeline-changed', { time })
  }

  /**
   * Start timeline playback
   */
  play(): void {
    this.state.playing = true
    this.emit('timeline-changed', { playing: true })
  }

  /**
   * Pause timeline playback
   */
  pause(): void {
    this.state.playing = false
    this.emit('timeline-changed', { playing: false })
  }

  /**
   * Set the layout mode
   */
  setLayoutMode(mode: 'split' | 'noodles-on-top' | 'output-on-top'): void {
    this.state.layoutMode = mode
    this.emit('data-changed', { layoutMode: mode })
  }

  /**
   * Set whether to show the overlay
   */
  setShowOverlay(show: boolean): void {
    this.state.showOverlay = show
    this.emit('data-changed', { showOverlay: show })
  }

  /**
   * Add an event listener
   */
  on(event: NoodlesGLEvent, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)?.add(listener)
  }

  /**
   * Remove an event listener
   */
  off(event: NoodlesGLEvent, listener: EventListener): void {
    this.eventListeners.get(event)?.delete(listener)
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: NoodlesGLEvent, ...args: unknown[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        listener(...args)
      }
    }
  }

  /**
   * Render a frame (used in external rendering mode)
   */
  renderFrame(frameData: FrameData): void {
    if (this.state.renderMode === 'external' && this.onFrameCallback) {
      // This will be implemented to capture the canvas
      this.emit('render', frameData)
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.eventListeners.clear()
    this.onFrameCallback = undefined
  }
}
