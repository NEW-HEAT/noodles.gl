/**
 * SubscriptionManager - Handles RxJS subscriptions to operator outputs
 */

import type { Subscription } from 'rxjs'
import type { OperatorStore } from './operator-manager'
import { LayerFactory } from './layer-factory'

export type VisualizationCallback = (props: any) => void

export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map()
  private layerFactory: LayerFactory

  constructor(layerFactory: LayerFactory) {
    this.layerFactory = layerFactory
  }

  /**
   * Subscribe to an operator's output
   */
  subscribeToOperator(
    operatorId: string,
    outputField: string,
    store: OperatorStore,
    callback: VisualizationCallback
  ): Subscription {
    const operator = store.getOp(operatorId)
    if (!operator || !operator.outputs) {
      throw new Error(`Operator not found or has no outputs: ${operatorId}`)
    }

    const field = (operator.outputs as any)[outputField]
    if (!field) {
      throw new Error(`Output field not found: ${operatorId}.${outputField}`)
    }

    // Subscribe to the field (which is a BehaviorSubject)
    const subscription = field.subscribe((value: any) => {
      console.log(`Operator ${operatorId}.${outputField} updated:`, value)

      // Process value through layer factory
      const processedValue = this.layerFactory.processVisualizationProps(value)
      callback(processedValue)
    })

    // Get initial value
    const initialValue = field.value
    if (initialValue) {
      const processedValue = this.layerFactory.processVisualizationProps(initialValue)
      callback(processedValue)
    }

    return subscription
  }

  /**
   * Subscribe to the main visualization operator (/deck)
   */
  subscribeToVisualization(
    store: OperatorStore,
    callback: VisualizationCallback
  ): Subscription {
    const deckOp = store.getOp('/deck')
    if (!deckOp || !deckOp.outputs || !('vis' in deckOp.outputs)) {
      throw new Error('/deck operator not found or has no vis output')
    }

    const visField = deckOp.outputs.vis
    const subscription = visField.subscribe((value: any) => {
      console.log('Vis props updated:', value)
      const processedValue = this.layerFactory.processVisualizationProps(value)
      callback(processedValue)
    })

    // Get initial value
    const initialValue = visField.value
    if (initialValue) {
      const processedValue = this.layerFactory.processVisualizationProps(initialValue)
      callback(processedValue)
    }

    // Track subscription
    this.subscriptions.set('visualization', subscription)

    return subscription
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(key: string): void {
    const subscription = this.subscriptions.get(key)
    if (subscription) {
      subscription.unsubscribe()
      this.subscriptions.delete(key)
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe()
    }
    this.subscriptions.clear()
  }

  /**
   * Add a subscription to track
   */
  track(key: string, subscription: Subscription): void {
    // Unsubscribe from existing if present
    this.unsubscribe(key)
    this.subscriptions.set(key, subscription)
  }
}
