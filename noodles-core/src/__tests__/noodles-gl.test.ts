/**
 * Tests for NoodlesGL core API
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NoodlesGL } from '../noodles-gl'
import type { NoodlesProject } from '../types'

describe('NoodlesGL', () => {
  let noodles: NoodlesGL

  const sampleProject: NoodlesProject = {
    version: 6,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }

  beforeEach(() => {
    noodles = NoodlesGL.create()
  })

  describe('creation', () => {
    it('should create an instance with default options', () => {
      const instance = NoodlesGL.create()
      const state = instance.getState()

      expect(state.editorVisible).toBe(true)
      expect(state.renderMode).toBe('standalone')
      expect(state.layoutMode).toBe('split')
      expect(state.showOverlay).toBe(true)
      expect(state.advancedControls).toBe(false)
    })

    it('should create an instance with custom options', () => {
      const instance = NoodlesGL.create({
        editorVisible: false,
        renderMode: 'external',
        layoutMode: 'output-on-top',
        advancedControls: true,
      })
      const state = instance.getState()

      expect(state.editorVisible).toBe(false)
      expect(state.renderMode).toBe('external')
      expect(state.layoutMode).toBe('output-on-top')
      expect(state.advancedControls).toBe(true)
    })

    it('should load a project during creation', () => {
      const instance = NoodlesGL.create({ project: sampleProject })
      const state = instance.getState()

      expect(state.project).toEqual(sampleProject)
    })
  })

  describe('editor visibility', () => {
    it('should toggle editor visibility', () => {
      noodles.setEditorVisibility(false)
      expect(noodles.getState().editorVisible).toBe(false)

      noodles.setEditorVisibility(true)
      expect(noodles.getState().editorVisible).toBe(true)
    })

    it('should emit data-changed event when toggling visibility', () => {
      let eventFired = false
      noodles.on('data-changed', () => {
        eventFired = true
      })

      noodles.setEditorVisibility(false)
      expect(eventFired).toBe(true)
    })
  })

  describe('project loading', () => {
    it('should load a project', async () => {
      await noodles.loadProject(sampleProject)
      expect(noodles.getState().project).toEqual(sampleProject)
    })

    it('should emit project-loaded event', async () => {
      let eventFired = false
      noodles.on('project-loaded', () => {
        eventFired = true
      })

      await noodles.loadProject(sampleProject)
      expect(eventFired).toBe(true)
    })
  })

  describe('timeline control', () => {
    it('should seek to a specific time', () => {
      noodles.seekTo(5.0)
      expect(noodles.getState().currentTime).toBe(5.0)
    })

    it('should play and pause', () => {
      noodles.play()
      expect(noodles.getState().playing).toBe(true)

      noodles.pause()
      expect(noodles.getState().playing).toBe(false)
    })

    it('should emit timeline-changed event', () => {
      let eventCount = 0
      noodles.on('timeline-changed', () => {
        eventCount++
      })

      noodles.seekTo(1.0)
      noodles.play()
      noodles.pause()

      expect(eventCount).toBe(3)
    })
  })

  describe('layout control', () => {
    it('should set layout mode', () => {
      noodles.setLayoutMode('noodles-on-top')
      expect(noodles.getState().layoutMode).toBe('noodles-on-top')
    })

    it('should set overlay visibility', () => {
      noodles.setShowOverlay(false)
      expect(noodles.getState().showOverlay).toBe(false)
    })
  })

  describe('event system', () => {
    it('should add and remove event listeners', () => {
      let callCount = 0
      const listener = () => {
        callCount++
      }

      noodles.on('data-changed', listener)
      noodles.setEditorVisibility(false)
      expect(callCount).toBe(1)

      noodles.off('data-changed', listener)
      noodles.setEditorVisibility(true)
      expect(callCount).toBe(1) // Should not increment
    })

    it('should support multiple listeners for the same event', () => {
      let count1 = 0
      let count2 = 0

      noodles.on('data-changed', () => {
        count1++
      })
      noodles.on('data-changed', () => {
        count2++
      })

      noodles.setEditorVisibility(false)
      expect(count1).toBe(1)
      expect(count2).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('should clean up resources', () => {
      let eventFired = false
      noodles.on('data-changed', () => {
        eventFired = true
      })

      noodles.destroy()
      noodles.setEditorVisibility(false)

      // Event should not fire after destroy
      expect(eventFired).toBe(false)
    })
  })
})
