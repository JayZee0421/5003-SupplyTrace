import { Link } from 'react-router-dom'
import type { EventRecord } from '../types'
import { formatCommitment, formatUtc } from '../lib/format'
import { StatusBadge } from './StatusBadge'

interface EventCardProps {
  event: EventRecord
  orderNumber?: string
  isLatest?: boolean
}

export function EventCard({ event, orderNumber, isLatest = false }: EventCardProps) {
  const orderQuery = orderNumber ? `?order=${encodeURIComponent(orderNumber)}` : ''

  return (
    <article
      className={event.is_exception ? 'event-card event-card--exception' : 'event-card'}
      aria-label={`Event ${event.event_id}: ${event.event_name}`}
    >
      <header className="event-card__head">
        <div className="event-card__heading">
          <div className="event-card__eyebrow">
            <span className="mono">{event.event_type_code}</span>
            <span className="muted">Event #{event.event_id}</span>
            <span className="mono muted event-card__time" title={formatUtc(event.event_time)}>
              {formatUtc(event.event_time)}
            </span>
            {isLatest ? <span className="tag tag--latest">Latest</span> : null}
            {event.is_exception ? <span className="tag tag--exception">Exception</span> : null}
          </div>
          <h3 className="event-card__name" title={event.event_name}>
            {event.event_name}
          </h3>
        </div>
        <StatusBadge status={event.status} />
      </header>

      <dl className="event-card__meta">
        <div className="meta-item">
          <dt>Entity</dt>
          <dd title={`${event.subject_entity} (${event.entity_type} #${event.entity_id})`}>
            <span className="meta-item__value">{event.subject_entity}</span>
            <span className="muted">
              {event.entity_type} #{event.entity_id}
            </span>
          </dd>
        </div>
        <div className="meta-item">
          <dt>Location</dt>
          <dd title={event.location_name ?? undefined}>
            {event.location_name ?? <span className="muted">Not recorded</span>}
          </dd>
        </div>
        <div className="meta-item">
          <dt>Order / line</dt>
          <dd>
            {event.order_id !== null ? `#${event.order_id}` : <span className="muted">—</span>}
            <span className="muted"> / </span>
            {event.order_line_id !== null ? (
              `#${event.order_line_id}`
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
        </div>
        <div className="meta-item">
          <dt>Commitment</dt>
          <dd title={event.current_commitment ?? undefined}>
            {formatCommitment(event.current_commitment)}
          </dd>
        </div>
      </dl>

      {event.message ? <p className="event-card__message">{event.message}</p> : null}

      <footer className="event-card__actions">
        <Link
          className="event-action"
          to={`/events/${event.event_id}/root-cause${orderQuery}`}
        >
          Root cause
        </Link>
        <Link className="event-action" to={`/events/${event.event_id}/impact${orderQuery}`}>
          Impact
        </Link>
      </footer>
    </article>
  )
}
