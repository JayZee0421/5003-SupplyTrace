import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { GraphNode } from '../types'
import { formatUtc, formatUtcShort, pluralize } from '../lib/format'
import { StatusDot } from './StatusBadge'

export interface NodeMarkers {
  selected?: boolean
  earliest?: boolean
  chainStart?: boolean
}

interface GraphNodeCardProps {
  node: GraphNode
  markers?: NodeMarkers
  style?: CSSProperties
  showSteps?: boolean
  compactEntity?: boolean
  orderQuery?: string
}

export function GraphNodeCard({
  node,
  markers = {},
  style,
  showSteps = true,
  compactEntity = false,
  orderQuery = '',
}: GraphNodeCardProps) {
  const className = [
    'graph-node',
    markers.selected ? 'graph-node--selected' : '',
    markers.earliest ? 'graph-node--earliest' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <div className="graph-node__top">
        <span className="mono graph-node__type" title={node.event_type_code}>
          {node.event_type_code}
        </span>
        {showSteps ? (
          <span className="graph-node__steps" title={`${node.steps} hops from the selected event`}>
            {pluralize(node.steps, 'hop')}
          </span>
        ) : null}
      </div>
      <p className="graph-node__name" title={node.event_name}>
        {node.event_name}
      </p>
      <p
        className="graph-node__entity"
        title={`${node.subject_entity} (${node.entity_type} #${node.entity_id})`}
      >
        <span className="mono">#{node.event_id}</span>
        <span className="graph-node__entity-name">
          {compactEntity ? node.entity_type : node.subject_entity}
        </span>
      </p>
      <div className="graph-node__meta">
        <StatusDot status={node.status} />
        <span className="mono graph-node__time" title={formatUtc(node.event_time)}>
          {formatUtcShort(node.event_time)}
        </span>
      </div>
      {(markers.selected || markers.earliest || markers.chainStart) && (
        <div className="graph-node__markers">
          {markers.selected ? <span className="node-tag node-tag--selected">Selected</span> : null}
          {markers.earliest ? (
            <span className="node-tag node-tag--earliest">Earliest exception</span>
          ) : null}
          {markers.chainStart ? <span className="node-tag node-tag--start">Chain start</span> : null}
        </div>
      )}
    </>
  )

  return (
    <Link
      className={className}
      style={style}
      to={`/events/${node.event_id}/root-cause${orderQuery}`}
      title={`Trace the root cause of event #${node.event_id}`}
    >
      {content}
    </Link>
  )
}
