import type { EdgeKind, GraphNode, Impact } from '../types'
import { graphDepth } from '../lib/graph'
import { EDGE_STYLE } from '../lib/theme'
import { GraphNodeCard } from './GraphNodeCard'

const NODE_W = 170
const NODE_H = 118
const GAP_X = 34
const GAP_Y = 16
const PAD = 22

interface Positioned {
  node: GraphNode
  x: number
  y: number
}

function edgePath(cause: Positioned, effect: Positioned, kind: EdgeKind): string {
  const offset = EDGE_STYLE[kind].offset
  const startX = cause.x + NODE_W
  const startY = cause.y + NODE_H / 2 + offset
  const endX = effect.x
  const endY = effect.y + NODE_H / 2 + offset

  if (endX > startX + 4) {
    const bend = Math.max(36, (endX - startX) * 0.5)
    return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`
  }

  // Same column or backward edge: route beneath the two cards.
  const belowX = cause.x + NODE_W / 2
  const belowY = cause.y + NODE_H
  const targetX = effect.x + NODE_W / 2
  const targetY = effect.y + NODE_H
  const bend = 40 + Math.abs(targetX - belowX) * 0.15
  return `M ${belowX} ${belowY} C ${belowX} ${belowY + bend}, ${targetX} ${targetY + bend}, ${targetX} ${targetY}`
}

export function ImpactGraph({ data }: { data: Impact }) {
  const byStep = new Map<number, GraphNode[]>()
  for (const node of data.nodes) {
    const bucket = byStep.get(node.steps)
    if (bucket) bucket.push(node)
    else byStep.set(node.steps, [node])
  }

  const maxStep = graphDepth(data)
  const columns = Array.from({ length: maxStep + 1 }, (_, step) => byStep.get(step) ?? [])
  const maxRows = Math.max(1, ...columns.map((column) => column.length))
  const width = PAD * 2 + (maxStep + 1) * NODE_W + maxStep * GAP_X
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y

  const positions = new Map<number, Positioned>()
  columns.forEach((nodes, step) => {
    const offset = ((maxRows - nodes.length) * (NODE_H + GAP_Y)) / 2
    nodes.forEach((node, row) => {
      positions.set(node.event_id, {
        node,
        x: PAD + step * (NODE_W + GAP_X),
        y: PAD + offset + row * (NODE_H + GAP_Y),
      })
    })
  })

  const kinds = Array.from(new Set(data.edges.map((edge) => edge.kind)))
  const orderNumbers = new Map(data.orders.map((order) => [order.order_id, order.order_number]))

  const laneStarts = data.orders.flatMap((order) => {
    const first = data.nodes
      .filter((node) => node.order_id === order.order_id)
      .sort(
        (a, b) =>
          a.steps - b.steps ||
          a.event_time.localeCompare(b.event_time) ||
          a.event_id - b.event_id,
      )[0]
    return first ? [{ order, first }] : []
  })

  return (
    <div
      className="graph-scroll"
      role="region"
      aria-label="Impact propagation graph; scroll horizontally to follow every hop"
      tabIndex={0}
    >
      <div className="graph-canvas" style={{ width, height }}>
        <svg className="graph-edges" width={width} height={height} aria-hidden="true">
          <defs>
            {kinds.map((kind) => (
              <marker
                key={kind}
                id={`arrow-${kind}`}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" fill={EDGE_STYLE[kind].stroke} />
              </marker>
            ))}
          </defs>
          {data.edges.map((edge) => {
            const cause = positions.get(edge.cause_event_id)
            const effect = positions.get(edge.effect_event_id)
            if (!cause || !effect) return null
            const style = EDGE_STYLE[edge.kind]
            return (
              <g key={`${edge.cause_event_id}-${edge.effect_event_id}-${edge.kind}`}>
                <title>
                  Event #{edge.cause_event_id} → event #{edge.effect_event_id} · {edge.kind}
                </title>
                <path
                  d={edgePath(cause, effect, edge.kind)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  markerEnd={`url(#arrow-${edge.kind})`}
                />
              </g>
            )
          })}
        </svg>
        {laneStarts.map(({ order, first }) => {
          const position = positions.get(first.event_id)
          if (!position) return null
          return (
            <span
              className="graph-lane-label mono"
              key={order.order_id}
              style={{ left: position.x, top: Math.max(2, position.y - 14) }}
            >
              {order.order_number}
            </span>
          )
        })}
        {Array.from(positions.values()).map((position) => (
          <GraphNodeCard
            key={position.node.event_id}
            node={position.node}
            markers={{ selected: position.node.steps === 0 }}
            showSteps={false}
            compactEntity
            orderQuery={
              position.node.order_id !== null && orderNumbers.has(position.node.order_id)
                ? `?order=${encodeURIComponent(orderNumbers.get(position.node.order_id)!)}`
                : ''
            }
            style={{
              left: position.x,
              top: position.y,
              width: NODE_W,
              height: NODE_H,
            }}
          />
        ))}
      </div>
    </div>
  )
}
