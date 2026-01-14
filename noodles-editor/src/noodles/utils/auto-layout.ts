import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import * as d3 from 'd3'

import type { AutoLayoutSettings } from './serialization'

export type LayoutOptions = AutoLayoutSettings & {
  nodeWidth?: number
  nodeHeight?: number
  nodeSpacing?: number
  rankSpacing?: number
}

const DEFAULT_NODE_WIDTH = 200
const DEFAULT_NODE_HEIGHT = 100
const DEFAULT_NODE_SPACING = 50
const DEFAULT_RANK_SPACING = 100

/**
 * Layout nodes using the specified algorithm.
 * Returns new nodes with updated positions.
 */
export function layoutNodes(nodes: Node[], edges: Edge[], options: LayoutOptions): Node[] {
  if (nodes.length === 0) return nodes

  const {
    algorithm,
    direction,
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    nodeSpacing = DEFAULT_NODE_SPACING,
    rankSpacing = DEFAULT_RANK_SPACING,
  } = options

  if (algorithm === 'dagre') {
    return layoutWithDagre(nodes, edges, {
      direction,
      nodeWidth,
      nodeHeight,
      nodeSpacing,
      rankSpacing,
    })
  }
  return layoutWithD3Force(nodes, edges, {
    direction,
    nodeWidth,
    nodeHeight,
    nodeSpacing,
  })
}

type DagreOptions = {
  direction: 'LR' | 'TB'
  nodeWidth: number
  nodeHeight: number
  nodeSpacing: number
  rankSpacing: number
}

function layoutWithDagre(nodes: Node[], edges: Edge[], options: DagreOptions): Node[] {
  const { direction, nodeWidth, nodeHeight, nodeSpacing, rankSpacing } = options

  // Create a new dagre graph
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 20,
    marginy: 20,
  })

  // Add nodes to the graph
  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? nodeWidth
    const height = node.measured?.height ?? node.height ?? nodeHeight
    g.setNode(node.id, { width, height })
  }

  // Add edges to the graph (only edges between nodes in our set)
  const nodeIds = new Set(nodes.map(n => n.id))
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  // Run the layout algorithm
  dagre.layout(g)

  // Map positions back to React Flow nodes
  return nodes.map(node => {
    const nodeWithPosition = g.node(node.id)
    if (!nodeWithPosition) return node

    // Dagre returns center coordinates, React Flow expects top-left
    const width = node.measured?.width ?? node.width ?? nodeWidth
    const height = node.measured?.height ?? node.height ?? nodeHeight

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    }
  })
}

type D3ForceOptions = {
  direction: 'LR' | 'TB'
  nodeWidth: number
  nodeHeight: number
  nodeSpacing: number
}

type SimNode = d3.SimulationNodeDatum & {
  id: string
  width: number
  height: number
  rank: number
}

type SimLink = d3.SimulationLinkDatum<SimNode> & {
  source: string | SimNode
  target: string | SimNode
}

function layoutWithD3Force(nodes: Node[], edges: Edge[], options: D3ForceOptions): Node[] {
  const { direction, nodeWidth, nodeHeight, nodeSpacing } = options

  // Calculate topological rank for each node to guide directional layout
  const ranks = calculateTopologicalRanks(nodes, edges)

  // Create simulation nodes
  const simNodes: SimNode[] = nodes.map(node => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? nodeWidth,
    height: node.measured?.height ?? node.height ?? nodeHeight,
    rank: ranks.get(node.id) ?? 0,
  }))

  // Create links for edges between our nodes
  const nodeIds = new Set(nodes.map(n => n.id))
  const simLinks: SimLink[] = edges
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map(e => ({
      source: e.source,
      target: e.target,
    }))

  // Create the simulation
  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id(d => d.id)
        .distance(nodeSpacing * 2)
        .strength(0.5)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force(
      'collide',
      d3.forceCollide<SimNode>().radius(d => Math.max(d.width, d.height) / 2 + nodeSpacing / 2)
    )
    .force('center', d3.forceCenter(0, 0))

  // Add directional force based on topological rank
  const maxRank = Math.max(...Array.from(ranks.values()), 1)
  if (direction === 'LR') {
    simulation.force(
      'x',
      d3.forceX<SimNode>(d => (d.rank / maxRank) * nodes.length * nodeSpacing * 1.5).strength(0.8)
    )
    simulation.force('y', d3.forceY<SimNode>(0).strength(0.1))
  } else {
    simulation.force(
      'y',
      d3.forceY<SimNode>(d => (d.rank / maxRank) * nodes.length * nodeSpacing * 1.5).strength(0.8)
    )
    simulation.force('x', d3.forceX<SimNode>(0).strength(0.1))
  }

  // Run simulation to completion
  simulation.stop()
  for (let i = 0; i < 300; i++) {
    simulation.tick()
  }

  // Map positions back to React Flow nodes
  const nodeMap = new Map(simNodes.map(n => [n.id, n]))
  return nodes.map(node => {
    const simNode = nodeMap.get(node.id)
    if (!simNode || simNode.x === undefined || simNode.y === undefined) return node

    return {
      ...node,
      position: {
        x: simNode.x,
        y: simNode.y,
      },
    }
  })
}

/**
 * Calculate topological rank for each node based on graph structure.
 * Nodes with no incoming edges have rank 0, others have rank = max(parent ranks) + 1.
 */
function calculateTopologicalRanks(nodes: Node[], edges: Edge[]): Map<string, number> {
  const nodeIds = new Set(nodes.map(n => n.id))
  const ranks = new Map<string, number>()

  // Build adjacency lists
  const incomingEdges = new Map<string, string[]>()
  for (const node of nodes) {
    incomingEdges.set(node.id, [])
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      incomingEdges.get(edge.target)?.push(edge.source)
    }
  }

  // Calculate ranks using BFS-like approach
  const queue = nodes.filter(n => incomingEdges.get(n.id)?.length === 0).map(n => n.id)
  for (const id of queue) {
    ranks.set(id, 0)
  }

  // Process nodes level by level
  const visited = new Set<string>()
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const incoming = incomingEdges.get(nodeId) ?? []
    const parentRanks = incoming.map(p => ranks.get(p) ?? 0)
    const rank = parentRanks.length > 0 ? Math.max(...parentRanks) + 1 : 0
    ranks.set(nodeId, rank)

    // Add children to queue
    for (const edge of edges) {
      if (edge.source === nodeId && nodeIds.has(edge.target) && !visited.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  // Handle any remaining unvisited nodes (disconnected or cycles)
  for (const node of nodes) {
    if (!ranks.has(node.id)) {
      ranks.set(node.id, 0)
    }
  }

  return ranks
}
