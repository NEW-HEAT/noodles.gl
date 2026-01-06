/**
 * TheatreManager - Handles Theatre.js initialization and operator binding
 */

import { getProject } from '@theatre/core'
import studio from '@theatre/studio'
import type { Operator } from '../types'

// Singleton instances to prevent double initialization
let studioInitialized = false
let projectInstance: any = null
let sheetInstance: any = null

export class TheatreManager {
  private project: any
  private sheet: any
  private ready: boolean = false

  constructor() {
    this.project = null
    this.sheet = null
  }

  /**
   * Initialize Theatre.js studio and project
   */
  async initialize(): Promise<void> {
    // Initialize studio once globally
    if (!studioInitialized) {
      studio.initialize()
      studio.ui.hide() // Hide by default
      studioInitialized = true
    }

    // Reuse existing project/sheet to avoid double initialization
    if (!projectInstance) {
      projectInstance = getProject('NoodlesDemo', {})
      sheetInstance = projectInstance.sheet('default')
    }

    this.project = projectInstance
    this.sheet = sheetInstance

    // Wait for Theatre.js to be ready
    await this.project.ready
    this.ready = true
  }

  /**
   * Bind an operator to Theatre.js for animation
   */
  bindOperator(operator: Operator, bindFn: (op: Operator, sheet: any) => void): void {
    if (!this.ready || !this.sheet) {
      console.warn('TheatreManager not ready, cannot bind operator:', operator.id)
      return
    }

    try {
      bindFn(operator, this.sheet)
    } catch (error) {
      console.warn('Failed to bind operator to Theatre.js:', operator.id, error)
    }
  }

  /**
   * Show Theatre.js studio UI
   */
  showUI(): void {
    studio.ui.restore()
  }

  /**
   * Hide Theatre.js studio UI
   */
  hideUI(): void {
    studio.ui.hide()
  }

  /**
   * Get the Theatre.js sheet for advanced usage
   */
  getSheet(): any {
    return this.sheet
  }

  /**
   * Get the Theatre.js project for advanced usage
   */
  getProject(): any {
    return this.project
  }

  /**
   * Check if Theatre.js is ready
   */
  isReady(): boolean {
    return this.ready
  }
}
