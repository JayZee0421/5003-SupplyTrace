import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchTimeline } from '../api/client'
import { useOrderPage } from '../context/OrderPageContext'
import { useApi } from '../hooks/useApi'
import { sortEventsNewestFirst } from '../lib/events'
import { pluralize } from '../lib/format'
import { EventCard } from '../components/EventCard'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { SearchBar } from '../components/SearchBar'
import { statusTone } from '../components/StatusBadge'
import { ClockIcon } from '../components/icons'

export function TimelinePage() {
  const { orderNumber = '' } = useParams()
  const navigate = useNavigate()
  const state = useApi(`timeline:${orderNumber}`, (signal) =>
    fetchTimeline(orderNumber, signal),
  )

  const data = state.data
  const events = data ? sortEventsNewestFirst(data.events) : []
  const latestException = events.find((event) => event.is_exception) ?? events[0]
  const { setOrderPage, clearOrderPage } = useOrderPage()

  useEffect(() => {
    if (!data) return
    setOrderPage(data.order_number, latestException?.event_id ?? null)
    return () => clearOrderPage()
  }, [data, latestException?.event_id, setOrderPage, clearOrderPage])

  const exceptions = data ? data.events.filter((event) => event.is_exception).length : 0
  const lineIds = data
    ? new Set(
        data.events
          .map((event) => event.order_line_id)
          .filter((id): id is number => id !== null),
      )
    : new Set<number>()
  const customer =
    data?.events.find((event) => event.entity_type === 'CUSTOMER')?.subject_entity ?? null
  const commitment =
    data?.events.find((event) => event.current_commitment !== null)?.current_commitment ?? null

  return (
    <div>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title mono">{orderNumber}</h1>
          <p className="page-subtitle">
            {data
              ? `${pluralize(data.count, 'event')}, ${pluralize(exceptions, 'exception')}, ${pluralize(lineIds.size, 'order line')}${customer ? `, ${customer}` : ''}${commitment ? `, commitment ${commitment}` : ''}`
              : 'Order event history from the SupplyTrace API'}
          </p>
        </div>
        <SearchBar
          kind="order"
          initialValue={orderNumber}
          buttonLabel="Open"
          onSearch={(value) => navigate(`/orders/${encodeURIComponent(value)}`)}
        />
      </header>

      {state.loading && !data ? <Loading label="Loading timeline" /> : null}

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} title="Timeline unavailable">
          <Link className="btn" to="/">
            Back to overview
          </Link>
        </ErrorState>
      ) : null}

      {data && !state.error ? (
        <>
          <div className="page-actions">
            <Link
              className="btn btn--ghost btn--sm"
              to={`/durations?order_number=${encodeURIComponent(orderNumber)}`}
            >
              <ClockIcon size={15} />
              Stage durations for this order
            </Link>
            <span className="timeline__direction">Newest first</span>
          </div>

          {data.events.length === 0 ? (
            <EmptyState title="This order has no events">
              <p>
                The order exists in the database but no supply-chain events are attached to it.
                Try another order number or load the benchmark dataset.
              </p>
            </EmptyState>
          ) : (
            <ol className="timeline" aria-label={`Events for order ${orderNumber}, newest first`}>
              {events.map((event, index) => (
                <li className="timeline__item" key={event.event_id}>
                  <div className="timeline__row">
                    <div
                      className={`timeline__rail timeline__rail--${statusTone(event.status)}`}
                      aria-hidden="true"
                    >
                      <span className="timeline__dot" />
                    </div>
                    <EventCard
                      event={event}
                      orderNumber={data.order_number}
                      isLatest={index === 0}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </div>
  )
}
