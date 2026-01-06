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
  Operator,
} from './noodles-api-types'
import { TheatreManager } from './managers/theatre-manager'
import { OperatorManager, type OperatorStore, type Edge } from './managers/operator-manager'
import { ExecutionEngine } from './managers/execution-engine'
import { LayerFactory, type ExtensionMap } from './managers/layer-factory'
import { SubscriptionManager, type VisualizationCallback } from './managers/subscription-manager'
import type { Subscription } from 'rxjs'

/**
 * NoodlesGL - Main API class for programmatic control
 *
 * @example
 * ```tsx
 * // Create with hidden editor
 * const noodles = NoodlesGL.create({ editorVisible: false });
 *
 * // Initialize the system
 * await noodles.initialize();
 *
 * // Subscribe to visualization changes
 * noodles.subscribeToChanges((visProps) => setProps(visProps));
 *
 * // Toggle editor visibility
 * noodles.setEditorVisibility(true);
 *
 * // Create operator programmatically
 * const filter = noodles.createOperator('FilterOp', '/filter-1');
 *
 * // Connect operators
 * noodles.connectOperators('/data', 'data', '/filter-1', 'data');
 *
 * // Modify operator inputs
 * const layer = noodles.getOperator('/my-layer');
 * layer.inputs.visible.setValue(false);
 * ```
 */
export class NoodlesGL {
  private state: NoodlesGLState
  private eventListeners: Map<NoodlesGLEvent, Set<EventListener>>
  private onFrameCallback?: (canvas: HTMLCanvasElement, frameData: FrameData) => void
  private initialized: boolean = false

  // Managers
  private managers: {
    theatre: TheatreManager
    operators: OperatorManager
    execution: ExecutionEngine
    layers: LayerFactory
    subscriptions: SubscriptionManager
  }

  private constructor(options: NoodlesGLOptions = {}) {
    this.state = {
      editorVisible: options.editorVisible ?? true,
      project: options.project ?? null,
      projectName: options.projectName,
      renderMode: options.renderMode ?? 'standalone',
      layoutMode: options.layoutMode ?? 'split',
      showOverlay: options.showOverlay ?? true,
      advancedControls: options.advancedControls ?? false,
      currentTime: 0,
      playing: false,
    }

    this.eventListeners = new Map()
    this.onFrameCallback = options.onFrame

    // Initialize managers
    const layerFactory = new LayerFactory()
    this.managers = {
      theatre: new TheatreManager(),
      operators: new OperatorManager(),
      execution: new ExecutionEngine(),
      layers: layerFactory,
      subscriptions: new SubscriptionManager(layerFactory),
    }
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
   * Initialize the Noodles system (call after create())
   * Sets up operator store, Theatre.js, executes graph
   */
  async initialize(
    dependencies: {
      operatorStore: OperatorStore
      transformGraph: (graph: { nodes: any[], edges: any[] }) => Operator[]
      bindOperatorToTheatre: (op: Operator, sheet: any) => void
      operatorTypes: Record<string, new (id: string) => Operator>
      extensionMap: ExtensionMap
      fileSystemStore?: any
    }
  ): Promise<void> {
    if (this.initialized) {
      console.warn('Already initialized')
      return
    }

    // Set dependencies
    this.managers.operators.setStore(dependencies.operatorStore)
    this.managers.operators.setTransformGraph(dependencies.transformGraph)
    this.managers.operators.setOperatorTypes(dependencies.operatorTypes)
    this.managers.layers.setExtensionMap(dependencies.extensionMap)

    // Initialize Theatre.js
    await this.managers.theatre.initialize()

    // Set project name in filesystem if provided
    if (this.state.projectName && dependencies.fileSystemStore) {
      dependencies.fileSystemStore.getState().setCurrentDirectory(null, this.state.projectName)
      dependencies.fileSystemStore.getState().setActiveStorageType('publicFolder')
    }

    // Load project if provided
    if (this.state.project) {
      const operators = this.managers.operators.loadProject(this.state.project)

      // Bind operators to Theatre.js
      for (const op of operators) {
        this.managers.theatre.bindOperator(op, dependencies.bindOperatorToTheatre)
      }

      // Execute graph after delay to allow Theatre.js to propagate values
      setTimeout(() => {
        this.managers.execution.execute(operators, this.state.project!.edges)
      }, 500)
    }

    this.initialized = true
    this.emit('initialized')
  }

  /**
   * Subscribe to visualization changes
   */
  subscribeToChanges(callback: VisualizationCallback): Subscription {
    if (!this.initialized) {
      throw new Error('Must call initialize() before subscribeToChanges()')
    }

    const store = this.managers.operators.getStore()

    // Wait for operators to be ready
    return new Promise<Subscription>((resolve) => {
      setTimeout(() => {
        const subscription = this.managers.subscriptions.subscribeToVisualization(store, callback)
        resolve(subscription)
      }, 800)
    }) as any
  }

  /**
   * Get visualization props (for external rendering)
   */
  getVisualizationProps(): any {
    const store = this.managers.operators.getStore()
    const deckOp = store.getOp('/deck')
    if (!deckOp || !deckOp.outputs || !('vis' in deckOp.outputs)) {
      return {}
    }
    return this.managers.layers.processVisualizationProps((deckOp.outputs as any).vis.value)
  }

  /**
   * Set editor visibility
   */
  setEditorVisibility(visible: boolean): void {
    this.state.editorVisible = visible
    if (visible) {
      this.managers.theatre.showUI()
    } else {
      this.managers.theatre.hideUI()
    }
    this.emit('data-changed', { editorVisible: visible })
  }

  /**
   * Load a project
   */
  async loadProject(project: NoodlesProject): Promise<void> {
    this.state.project = project
    this.emit('project-loaded', project)

    if (this.initialized) {
      // Reload operators
      const operators = this.managers.operators.loadProject(project)
      this.managers.execution.execute(operators, project.edges)
    }
  }

  /**
   * Get the operator store for direct access
   */
  getOperatorStore(): OperatorStore {
    return this.managers.operators.getStore()
  }

  /**
   * Get an operator by ID
   */
  getOperator(id: string): Operator | undefined {
    return this.managers.operators.getOperator(id)
  }

  /**
   * Create a new operator dynamically
   */
  createOperator(type: string, id: string, inputs?: Record<string, any>): Operator {
    return this.managers.operators.createOperator(type, id, inputs)
  }

  /**
   * Delete an operator
   */
  deleteOperator(id: string): void {
    this.managers.operators.deleteOperator(id)
  }

  /**
   * Connect two operators
   */
  connectOperators(
    sourceId: string,
    sourceOutput: string,
    targetId: string,
    targetInput: string
  ): void {
    this.managers.operators.connectOperators(sourceId, sourceOutput, targetId, targetInput)
  }

  /**
   * Disconnect an operator input
   */
  disconnectOperator(targetId: string, targetInput: string): void {
    this.managers.operators.disconnectOperator(targetId, targetInput)
  }

  /**
   * Add an edge to the project graph (for visualization)
   */
  addEdge(edge: Edge & { id?: string }): void {
    if (!this.state.project) return

    const edgeId = edge.id || `${edge.source}-${edge.target}`
    this.state.project.edges.push({
      id: edgeId,
      ...edge
    })
  }

  /**
   * Remove an edge from the project graph
   */
  removeEdge(edgeId: string): void {
    if (!this.state.project) return
    this.state.project.edges = this.state.project.edges.filter(e => e.id !== edgeId)
  }

  /**
   * Execute the entire graph
   */
  executeGraph(): void {
    if (!this.state.project) return
    const store = this.managers.operators.getStore()
    const operators = store.getAllOps()
    this.managers.execution.execute(operators, this.state.project.edges)
  }

  /**
   * Execute a single operator
   */
  executeOperator(id: string): void {
    const operator = this.getOperator(id)
    if (operator) {
      this.managers.execution.executeOperator(operator)
    }
  }

  /**
   * Set data for a specific operator
   */
  setData(operatorId: string, data: unknown): void {
    const op = this.getOperator(operatorId)
    if (op && op.inputs && 'value' in op.inputs) {
      (op.inputs as any).value.setValue(data)
    }
    this.emit('data-changed', { operatorId, data })
  }

  /**
   * Get output data from an operator
   */
  getData(operatorId: string): unknown {
    const op = this.getOperator(operatorId)
    if (op && op.outputs && 'value' in op.outputs) {
      return (op.outputs as any).value.value
    }
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
