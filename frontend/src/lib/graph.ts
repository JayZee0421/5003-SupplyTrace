import type { Graph, GraphNode } from '../types'

/** The selected event is the one at step 0; fall back to the first returned node. */
export function selectedNode(graph: Graph): GraphNode | undefined {
  return graph.nodes.find((node) => node.steps === 0) ?? graph.nodes[0]
}

/** Longest shortest-path distance from the selected event in the returned subgraph. */
export function graphDepth(graph: Graph): number {
  return graph.nodes.reduce((max, node) => Math.max(max, node.steps), 0)
}
