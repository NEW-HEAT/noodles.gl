/**
 * OperatorManager - Handles operator creation, loading, and store management
 */

import type { Operator, NoodlesProject } from '../types'

export interface OperatorStore {
  getOp(id: string): Operator | undefined
  setOp(id: string, op: Operator): void
  deleteOp(id: string): void
  getAllOps(): Operator[]
  clearOps(): void
  batch(fn: () => void): void
}

export interface Edge {
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

export class OperatorManager {
  private store: OperatorStore | null = null
  private transformGraphFn: ((graph: { nodes: any[], edges: any[] }) => Operator[]) | null = null
  private opTypes: Record<string, new (id: string) => Operator> = {}

  constructor() {}

  /**
   * Set the operator store (from noodles-editor)
   */
  setStore(store: OperatorStore): void {
    this.store = store
  }

  /**
   * Set the transformGraph function (from noodles-editor)
   */
  setTransformGraph(fn: (graph: { nodes: any[], edges: any[] }) => Operator[]): void {
    this.transformGraphFn = fn
  }

  /**
   * Set available operator types for dynamic creation
   */
  setOperatorTypes(types: Record<string, new (id: string) => Operator>): void {
    this.opTypes = types
  }

  /**
   * Get the operator store
   */
  getStore(): OperatorStore {
    if (!this.store) {
      throw new Error('Operator store not initialized. Call setStore() first.')
    }
    return this.store
  }

  /**
   * Load project and transform graph into operators
   */
  loadProject(project: NoodlesProject): Operator[] {
    if (!this.store || !this.transformGraphFn) {
      throw new Error('OperatorManager not fully initialized')
    }

    // Clear existing operators
    for (const op of this.store.getAllOps()) {
      (op as any).unsubscribeListeners?.()
    }
    this.store.clearOps()

    // Transform nodes/edges into operators
    try {
      const operators = this.transformGraphFn({
        nodes: project.nodes,
        edges: project.edges
      })
      return operators
    } catch (error) {
      console.error('Failed to load project:', error)
      return []
    }
  }

  /**
   * Create a new operator dynamically
   */
  createOperator(type: string, id: string, inputs?: Record<string, any>): Operator {
    const OperatorClass = this.opTypes[type]
    if (!OperatorClass) {
      throw new Error(`Unknown operator type: ${type}`)
    }

    const operator = new OperatorClass(id)

    // Set initial input values if provided
    if (inputs && operator.inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        if (key in operator.inputs) {
          (operator.inputs as any)[key].setValue(value)
        }
      }
    }

    // Add to store
    if (this.store) {
      this.store.setOp(id, operator)
    }

    return operator
  }

  /**
   * Get an operator by ID
   */
  getOperator(id: string): Operator | undefined {
    return this.store?.getOp(id)
  }

  /**
   * Delete an operator
   */
  deleteOperator(id: string): void {
    const op = this.getOperator(id)
    if (op) {
      (op as any).unsubscribeListeners?.()
    }
    this.store?.deleteOp(id)
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
    if (!this.store) return

    const source = this.store.getOp(sourceId)
    const target = this.store.getOp(targetId)

    if (!source || !target) {
      throw new Error(`Operator not found: ${!source ? sourceId : targetId}`)
    }

    if (!source.outputs || !(sourceOutput in source.outputs)) {
      throw new Error(`Source output not found: ${sourceId}.${sourceOutput}`)
    }

    if (!target.inputs || !(targetInput in target.inputs)) {
      throw new Error(`Target input not found: ${targetId}.${targetInput}`)
    }

    // Connect the output to the input
    const sourceField = (source.outputs as any)[sourceOutput]
    const targetField = (target.inputs as any)[targetInput]

    if (targetField && typeof targetField.connect === 'function') {
      targetField.connect(sourceField)
    } else {
      throw new Error(`Cannot connect: ${targetId}.${targetInput} has no connect method`)
    }
  }

  /**
   * Disconnect an operator input
   */
  disconnectOperator(targetId: string, targetInput: string): void {
    if (!this.store) return

    const target = this.store.getOp(targetId)
    if (!target || !target.inputs) return

    const targetField = (target.inputs as any)[targetInput]
    if (targetField && typeof targetField.disconnect === 'function') {
      targetField.disconnect()
    }
  }

  /**
   * Clear all operators
   */
  clearOperators(): void {
    if (!this.store) return

    for (const op of this.store.getAllOps()) {
      (op as any).unsubscribeListeners?.()
    }
    this.store.clearOps()
  }
}
