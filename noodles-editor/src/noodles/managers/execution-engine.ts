/**
 * ExecutionEngine - Handles topological sorting and operator execution
 */

import type { Operator } from '../types'
import type { Edge } from './operator-manager'

export class ExecutionEngine {
  constructor() {}

  /**
   * Execute all operators in topological order
   */
  execute(operators: Operator[], edges: Edge[]): void {
    // Build dependency graph
    const opMap = new Map(operators.map(op => [op.id, op]))
    const inDegree = new Map(operators.map(op => [op.id, 0]))
    const adjacencyList = new Map<string, string[]>(operators.map(op => [op.id, []]))

    // Calculate in-degrees and build adjacency list from edges
    for (const edge of edges) {
      const sourceId = edge.source
      const targetId = edge.target
      if (opMap.has(sourceId) && opMap.has(targetId)) {
        adjacencyList.get(sourceId)?.push(targetId)
        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1)
      }
    }

    // Topological sort using Kahn's algorithm
    const queue: string[] = []
    const sorted: string[] = []

    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(id)
    }

    while (queue.length > 0) {
      const opId = queue.shift()!
      sorted.push(opId)

      const neighbors = adjacencyList.get(opId) || []
      for (const neighborId of neighbors) {
        const newDegree = (inDegree.get(neighborId) || 0) - 1
        inDegree.set(neighborId, newDegree)
        if (newDegree === 0) queue.push(neighborId)
      }
    }

    console.log('Execution order:', sorted)

    // Execute operators in topological order
    for (const opId of sorted) {
      const op = opMap.get(opId)
      if (!op) continue

      try {
        if (typeof op.execute === 'function') {
          // Get all input values
          const inputs: any = {}
          Object.keys(op.inputs).forEach(key => {
            inputs[key] = (op.inputs as any)[key].value
          })

          // Execute the operator
          console.log(`Executing ${op.id}...`, {
            inputs: Object.keys(inputs),
          })
          const outputs = op.execute(inputs)

          // Set the output values
          if (outputs) {
            Object.keys(outputs).forEach(key => {
              if ((op.outputs as any)[key]) {
                (op.outputs as any)[key].setValue(outputs[key])
                console.log(`  ${op.id}.${key} = ${typeof outputs[key]}`)
              }
            })
          }
        }
      } catch (error) {
        console.error(`Failed to execute ${op.id}:`, error)
      }
    }

    console.log('Initial execution complete')
  }

  /**
   * Execute a single operator
   */
  executeOperator(operator: Operator): void {
    try {
      if (typeof operator.execute === 'function') {
        const inputs: any = {}
        Object.keys(operator.inputs).forEach(key => {
          inputs[key] = (operator.inputs as any)[key].value
        })

        const outputs = operator.execute(inputs)

        if (outputs) {
          Object.keys(outputs).forEach(key => {
            if ((operator.outputs as any)[key]) {
              (operator.outputs as any)[key].setValue(outputs[key])
            }
          })
        }
      }
    } catch (error) {
      console.error(`Failed to execute ${operator.id}:`, error)
    }
  }
}
