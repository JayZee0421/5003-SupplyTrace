import { describe, expect, it } from 'vitest'
import type { Graph, GraphNode } from '../types'
import { graphDepth, selectedNode } from './graph'

function node(eventId: number, steps: number): GraphNode {
  return {
    event_id: eventId,
    event_type_code: 'TEST_EVENT',
    event_name: 'Test event',
    event_time: '2026-01-01T00:00:00Z',
    status: 'NORMAL',
    is_exception: false,
    entity_type: 'CUSTOMER',
    entity_id: 1,
    subject_entity: 'Test entity',
    location_id: null,
    location_name: null,
    order_id: null,
    order_line_id: null,
    caused_by_event_id: null,
    causal_depth: 0,
    message: null,
    current_commitment: null,
    steps,
    path: [eventId],
  }
}

function graph(nodes: GraphNode[]): Graph {
  return {
    selected_event_id: nodes.find((item) => item.steps === 0)?.event_id ?? nodes[0]?.event_id ?? 0,
    max_depth: 64,
    count: nodes.length,
    nodes,
    edges: [],
    truncated: false,
    cycle_detected: false,
  }
}

describe('selectedNode', () => {
  it('returns the node at step 0 even when it is not first', () => {
    const selected = node(2, 0)
    expect(selectedNode(graph([node(1, 3), selected]))).toBe(selected)
  })

  it('falls back to the first node when no step-0 node exists', () => {
    const first = node(7, 2)
    expect(selectedNode(graph([first, node(8, 1)]))).toBe(first)
  })

  it('returns undefined for an empty graph', () => {
    expect(selectedNode(graph([]))).toBeUndefined()
  })
})

describe('graphDepth', () => {
  it('returns the largest step count', () => {
    expect(graphDepth(graph([node(1, 0), node(2, 3), node(3, 1)]))).toBe(3)
  })

  it('returns zero for an empty graph', () => {
    expect(graphDepth(graph([]))).toBe(0)
  })
})
