import type { CSSProperties } from 'react'
import type { GraphEdge, GraphNode, RootCause } from '../types'
import { formatUtc } from '../lib/format'
import { EDGE_STYLE } from '../lib/theme'
import { GraphNodeCard } from './GraphNodeCard'
import { statusTone } from './StatusBadge'

function edgeBetween(edges: GraphEdge[], causeId: number, effectId: number): GraphEdge | undefined {
  return edges.find(
    (edge) => edge.cause_event_id === causeId && edge.effect_event_id === effectId,
  )
}

function edgeKey(edge: GraphEdge): string {
  return `${edge.cause_event_id}-${edge.effect_event_id}-${edge.kind}`
}

export function RootCauseChain({ data, orderQuery }: { data: RootCause; orderQuery?: string }) {
  const ordered = [...data.nodes].sort(
    (a: GraphNode, b: GraphNode) =>
      b.steps - a.steps ||
      a.event_time.localeCompare(b.event_time) ||
      a.event_id - b.event_id,
  )

  // Edges between adjacent rows are drawn by the vertical rail. Any other
  // edge (a cycle-closing edge, or a second kind for the same pair) is listed
  // below the chain so every returned edge is still represented.
  const drawnEdgeKeys = new Set<string>()
  for (let index = 1; index < ordered.length; index += 1) {
    const edge = edgeBetween(data.edges, ordered[index - 1].event_id, ordered[index].event_id)
    if (edge) drawnEdgeKeys.add(edgeKey(edge))
  }
  const extraEdges = data.edges.filter((edge) => !drawnEdgeKeys.has(edgeKey(edge)))

  return (
    <div className="chain-wrap">
      <ol className="chain" aria-label="Root-cause chain, earliest cause first">
        {ordered.map((node, index) => {
          const previous = index > 0 ? ordered[index - 1] : undefined
          const edge = previous
            ? edgeBetween(data.edges, previous.event_id, node.event_id)
            : undefined
          const railClass = edge ? `chain__rail--${edge.kind.toLowerCase()}` : 'chain__rail--none'

          return (
            <li className="chain__item" key={node.event_id}>
              <div className="chain__row">
                <time
                  className="chain__time mono"
                  dateTime={node.event_time}
                  title={formatUtc(node.event_time)}
                >
                  {formatUtc(node.event_time)}
                </time>
                <div
                  className={`chain__rail ${railClass}`}
                  style={
                    {
                      '--rail-color': edge ? EDGE_STYLE[edge.kind].stroke : 'var(--border)',
                    } as CSSProperties
                  }
                  aria-hidden="true"
                  title={edge ? `Edge kind: ${edge.kind}` : 'No direct edge returned'}
                >
                  <span className={`chain__dot chain__dot--${statusTone(node.status)}`} />
                </div>
                <div className="chain__card-wrap">
                  <GraphNodeCard
                    node={node}
                    orderQuery={orderQuery}
                    markers={{
                      selected: node.steps === 0,
                      earliest: node.event_id === data.earliest_exception_event_id,
                      chainStart: node.event_id === data.chain_start_event_id,
                    }}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {extraEdges.length > 0 ? (
        <div className="chain__extra">
          <p className="chain__extra-title">Other edges in the returned subgraph</p>
          <ul>
            {extraEdges.map((edge) => (
              <li key={edgeKey(edge)}>
                <span className="mono">
                  #{edge.cause_event_id} → #{edge.effect_event_id}
                </span>
                <span className="chain__extra-kind">
                  <span
                    className="chain__extra-swatch"
                    style={{ background: EDGE_STYLE[edge.kind].stroke }}
                    aria-hidden="true"
                  />
                  {edge.kind}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function EdgeLegend({ edges }: { edges: GraphEdge[] }) {
  const kinds = Array.from(new Set(edges.map((edge) => edge.kind)))

  if (kinds.length === 0) return null

  return (
    <div className="edge-legend" aria-label="Edge kinds">
      <span className="edge-legend__label">Cause → effect</span>
      {kinds.map((kind) => (
        <span className="edge-legend__item" key={kind}>
          <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true">
            <path
              d="M1 4h26"
              fill="none"
              stroke={EDGE_STYLE[kind].stroke}
              strokeWidth={EDGE_STYLE[kind].width}
              strokeDasharray={EDGE_STYLE[kind].dash}
              strokeLinecap="round"
            />
          </svg>
          <span>{kind}</span>
        </span>
      ))}
    </div>
  )
}
