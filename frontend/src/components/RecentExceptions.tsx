import { Link } from 'react-router-dom'
import type { RecentExceptionsState } from '../hooks/useRecentExceptions'
import { formatCommitment, formatUtc } from '../lib/format'
import { StatusBadge } from './StatusBadge'

export function RecentExceptions({
  state,
  scopeLabel = 'the watched orders',
}: {
  state: RecentExceptionsState
  scopeLabel?: string
}) {
  const countLabel = state.loading
    ? 'Checking...'
    : state.error
      ? 'Unavailable'
      : `${state.exceptions.length} shown`

  return (
    <section className="recent-panel" aria-labelledby="recent-heading">
      <header className="recent-panel__head">
        <div>
          <h2 id="recent-heading">Latest exceptions</h2>
          <p>Newest WARNING or FAILED events across {scopeLabel}.</p>
        </div>
        <span className="recent-panel__count mono">{countLabel}</span>
      </header>

      {state.loading ? (
        <p className="recent-panel__empty">Loading recent events...</p>
      ) : state.error ? (
        <p className="recent-panel__empty">
          Could not load recent events. Check that the API is running, then reload.
        </p>
      ) : state.exceptions.length === 0 ? (
        <p className="recent-panel__empty">No exceptions in {scopeLabel}.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table recent-table">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Order / customer</th>
                <th scope="col">Status</th>
                <th scope="col">Time / commitment (UTC)</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {state.exceptions.map(({ event, orderNumber, customer, commitment }) => {
                const orderQuery = `?order=${encodeURIComponent(orderNumber)}`
                return (
                  <tr key={`${orderNumber}-${event.event_id}`}>
                    <td>
                      <span className="recent-table__sr-label">Event: </span>
                      <span className="mono">#{event.event_id}</span>{' '}
                      <span className="muted">{event.event_type_code}</span>
                    </td>
                    <td>
                      <span className="recent-table__sr-label">Order: </span>
                      <Link
                        className="text-link mono"
                        to={`/orders/${encodeURIComponent(orderNumber)}`}
                      >
                        {orderNumber}
                      </Link>
                      {customer ? (
                        <span className="recent-sub">Customer · {customer}</span>
                      ) : null}
                    </td>
                    <td>
                      <span className="recent-table__sr-label">Status: </span>
                      <StatusBadge status={event.status} size="sm" />
                    </td>
                    <td className="mono">
                      <span className="recent-table__sr-label">Time: </span>
                      {formatUtc(event.event_time)}
                      {commitment ? (
                        <span className="recent-sub">
                          Commitment {formatCommitment(commitment)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className="recent-table__sr-label">Open: </span>
                      <div className="recent-links">
                        <Link
                          className="text-link"
                          to={`/events/${event.event_id}/root-cause${orderQuery}`}
                        >
                          Root cause
                        </Link>
                        <Link
                          className="text-link"
                          to={`/events/${event.event_id}/impact${orderQuery}`}
                        >
                          Impact
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
