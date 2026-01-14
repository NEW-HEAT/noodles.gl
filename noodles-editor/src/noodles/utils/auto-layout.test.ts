import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { layoutNodes, type LayoutOptions } from './auto-layout'

const createNode = (id: string, x = 0, y = 0, width = 200, height = 100): Node => ({
  id,
  position: { x, y },
  data: {},
  measured: { width, height },
})

const createEdge = (source: string, target: string): Edge => ({
  id: `${source}->${target}`,
  source,
  target,
})

describe('layoutNodes', () => {
  describe('with dagre algorithm', () => {
    const dagreOptions: LayoutOptions = {
      enabled: true,
      algorithm: 'dagre',
      direction: 'LR',
    }

    it('returns empty array for empty input', () => {
      const result = layoutNodes([], [], dagreOptions)
      expect(result).toEqual([])
    })

    it('returns single node with same position', () => {
      const nodes = [createNode('a', 100, 100)]
      const result = layoutNodes(nodes, [], dagreOptions)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('a')
    })

    it('layouts connected nodes in a line for LR direction', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const edges = [createEdge('a', 'b'), createEdge('b', 'c')]
      const result = layoutNodes(nodes, edges, dagreOptions)

      expect(result).toHaveLength(3)

      const nodeA = result.find(n => n.id === 'a')!
      const nodeB = result.find(n => n.id === 'b')!
      const nodeC = result.find(n => n.id === 'c')!

      // In LR layout, x positions should increase from a to b to c
      expect(nodeA.position.x).toBeLessThan(nodeB.position.x)
      expect(nodeB.position.x).toBeLessThan(nodeC.position.x)
    })

    it('layouts connected nodes vertically for TB direction', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const edges = [createEdge('a', 'b'), createEdge('b', 'c')]
      const result = layoutNodes(nodes, edges, { ...dagreOptions, direction: 'TB' })

      const nodeA = result.find(n => n.id === 'a')!
      const nodeB = result.find(n => n.id === 'b')!
      const nodeC = result.find(n => n.id === 'c')!

      // In TB layout, y positions should increase from a to b to c
      expect(nodeA.position.y).toBeLessThan(nodeB.position.y)
      expect(nodeB.position.y).toBeLessThan(nodeC.position.y)
    })

    it('handles branching graphs', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c'), createNode('d')]
      const edges = [createEdge('a', 'b'), createEdge('a', 'c'), createEdge('b', 'd'), createEdge('c', 'd')]
      const result = layoutNodes(nodes, edges, dagreOptions)

      expect(result).toHaveLength(4)

      const nodeA = result.find(n => n.id === 'a')!
      const nodeD = result.find(n => n.id === 'd')!

      // a should be leftmost, d should be rightmost
      expect(nodeA.position.x).toBeLessThan(nodeD.position.x)
    })

    it('produces non-overlapping nodes', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const edges = [createEdge('a', 'b'), createEdge('a', 'c')]
      const result = layoutNodes(nodes, edges, dagreOptions)

      // Check no nodes overlap
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const n1 = result[i]
          const n2 = result[j]
          const w1 = n1.measured?.width ?? 200
          const h1 = n1.measured?.height ?? 100
          const w2 = n2.measured?.width ?? 200
          const h2 = n2.measured?.height ?? 100

          const xOverlap =
            n1.position.x < n2.position.x + w2 && n1.position.x + w1 > n2.position.x
          const yOverlap =
            n1.position.y < n2.position.y + h2 && n1.position.y + h1 > n2.position.y

          expect(xOverlap && yOverlap).toBe(false)
        }
      }
    })
  })

  describe('with d3-force algorithm', () => {
    const forceOptions: LayoutOptions = {
      enabled: true,
      algorithm: 'd3-force',
      direction: 'LR',
    }

    it('returns empty array for empty input', () => {
      const result = layoutNodes([], [], forceOptions)
      expect(result).toEqual([])
    })

    it('returns single node', () => {
      const nodes = [createNode('a', 100, 100)]
      const result = layoutNodes(nodes, [], forceOptions)
      expect(result).toHaveLength(1)
    })

    it('layouts connected nodes', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const edges = [createEdge('a', 'b'), createEdge('b', 'c')]
      const result = layoutNodes(nodes, edges, forceOptions)

      expect(result).toHaveLength(3)
      // Each node should have a position
      for (const node of result) {
        expect(typeof node.position.x).toBe('number')
        expect(typeof node.position.y).toBe('number')
        expect(Number.isFinite(node.position.x)).toBe(true)
        expect(Number.isFinite(node.position.y)).toBe(true)
      }
    })

    it('respects direction for topological ordering', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const edges = [createEdge('a', 'b'), createEdge('b', 'c')]
      const result = layoutNodes(nodes, edges, forceOptions)

      const nodeA = result.find(n => n.id === 'a')!
      const nodeC = result.find(n => n.id === 'c')!

      // In LR layout, a should generally be left of c
      expect(nodeA.position.x).toBeLessThan(nodeC.position.x)
    })

    it('produces finite positions for disconnected nodes', () => {
      const nodes = [createNode('a'), createNode('b'), createNode('c')]
      const result = layoutNodes(nodes, [], forceOptions)

      for (const node of result) {
        expect(Number.isFinite(node.position.x)).toBe(true)
        expect(Number.isFinite(node.position.y)).toBe(true)
      }
    })
  })
})
