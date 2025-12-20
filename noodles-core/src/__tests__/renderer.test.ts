/**
 * Tests for visualization renderer utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createVisualizationRenderer, VisualizationRenderer } from '../utils/renderer'

describe('VisualizationRenderer', () => {
  let renderer: VisualizationRenderer

  beforeEach(() => {
    renderer = createVisualizationRenderer({
      width: 1920,
      height: 1080,
    })
  })

  describe('creation', () => {
    it('should create a renderer with default canvas', () => {
      const canvas = renderer.getCanvas()
      expect(canvas).toBeInstanceOf(HTMLCanvasElement)
      expect(canvas.width).toBe(1920)
      expect(canvas.height).toBe(1080)
    })

    it('should create a renderer with custom canvas', () => {
      const customCanvas = document.createElement('canvas')
      customCanvas.width = 800
      customCanvas.height = 600

      const customRenderer = createVisualizationRenderer({
        canvas: customCanvas,
      })

      expect(customRenderer.getCanvas()).toBe(customCanvas)
      expect(customRenderer.getCanvas().width).toBe(800)
    })
  })

  describe('rendering lifecycle', () => {
    it('should start and stop rendering', () => {
      expect(renderer.isRendering()).toBe(false)

      renderer.start()
      expect(renderer.isRendering()).toBe(true)

      renderer.stop()
      expect(renderer.isRendering()).toBe(false)
    })

    it('should call onComplete when stopped', () => {
      const onComplete = vi.fn()
      const testRenderer = createVisualizationRenderer({
        onComplete,
      })

      testRenderer.start()
      testRenderer.stop()

      expect(onComplete).toHaveBeenCalledOnce()
    })
  })

  describe('frame capture', () => {
    it('should capture frames when rendering', () => {
      const onFrame = vi.fn()
      const testRenderer = createVisualizationRenderer({
        onFrame,
      })

      testRenderer.start()
      testRenderer.captureFrame(0.0, false)
      testRenderer.captureFrame(0.033, false)
      testRenderer.captureFrame(0.066, true)

      expect(onFrame).toHaveBeenCalledTimes(3)
    })

    it('should not capture frames when not rendering', () => {
      const onFrame = vi.fn()
      const testRenderer = createVisualizationRenderer({
        onFrame,
      })

      testRenderer.captureFrame(0.0, false)
      expect(onFrame).not.toHaveBeenCalled()
    })

    it('should stop rendering on last frame', () => {
      const testRenderer = createVisualizationRenderer()

      testRenderer.start()
      expect(testRenderer.isRendering()).toBe(true)

      testRenderer.captureFrame(5.0, true)
      expect(testRenderer.isRendering()).toBe(false)
    })

    it('should pass correct frame data', () => {
      const onFrame = vi.fn()
      const testRenderer = createVisualizationRenderer({
        onFrame,
      })

      testRenderer.start()
      testRenderer.captureFrame(1.5, false)

      expect(onFrame).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        expect.objectContaining({
          timestamp: 1.5,
          frameNumber: 0,
          isLastFrame: false,
        })
      )
    })

    it('should increment frame numbers', () => {
      const frames: number[] = []
      const testRenderer = createVisualizationRenderer({
        onFrame: (_, frameData) => {
          frames.push(frameData.frameNumber)
        },
      })

      testRenderer.start()
      testRenderer.captureFrame(0.0, false)
      testRenderer.captureFrame(0.033, false)
      testRenderer.captureFrame(0.066, false)

      expect(frames).toEqual([0, 1, 2])
    })
  })
})
