import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, fetchImpact } from '../api/client'
import { useApi } from '../hooks/useApi'
import { formatUtc, pluralize } from '../lib/format'
import { graphDepth, selectedNode } from '../lib/graph'
import { parsePositiveInt } from '../lib/ids'
import { EdgeLegend } from '../components/RootCauseChain'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { GraphFlags } from '../components/GraphFlags'
import { ImpactGraph } from '../components/ImpactGraph'
import { Loading } from '../components/Loading'
import { Metrics } from '../components/Metrics'
import { SearchBar } from '../components/SearchBar'
import { ArrowRightIcon } from '../components/icons'

export function ImpactPage() {
  const { eventId: eventIdParam = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const eventId = parsePositiveInt(eventIdParam)
  const contextOrder = new URLSearchParams(location.search).get('order')
  const orderQuery = contextOrder ? `?order=${encodeURIComponent(contextOrder)}` : ''

  const state = useApi(
    `impact:${eventId ?? `invalid:${eventIdParam}`}`,
    (signal) =>
      eventId !== null
        ? fetchImpact(eventId, signal)
        : Promise.reject(
            new ApiError('Event id must be a positive integer.', 422, 'VALIDATION_ERROR'),
          ),
  )

  const data = state.data
  const selected = data ? selectedNode(data) : undefined
  const maxSteps = data ? graphDepth(data) : 0
  const affectedLines = data
    ? data.orders.reduce((total, order) => total + order.lines.length, 0)
    : 0
  const sourceOrder = data?.orders.find(
    (order) => order.order_id === selected?.order_id,
  )?.order_number
  const rootCauseOrderQuery = contextOrder
    ? orderQuery
    : sourceOrder
      ? `?order=${encodeURIComponent(sourceOrder)}`
      : orderQuery

  return (
    <div>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title">Event #{eventId ?? eventIdParam}</h1>
          <p className="page-subtitle">
            {selected
              ? `${selected.event_name} · ${formatUtc(selected.event_time)}`
              : 'Walk causal edges forward to the orders and lines that are exposed'}
          </p>
        </div>
        <SearchBar
          kind="event"
          initialValue={eventId !== null ? String(eventId) : ''}
          buttonLabel="Inspect"
          onSearch={(value) => navigate(`/events/${value}/impact${orderQuery}`)}
        />
      </header>

      {state.loading && !data ? <Loading label="Loading impact graph" /> : null}

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} title="Impact view unavailable">
          <Link className="btn" to="/">
            Back to overview
          </Link>
        </ErrorState>
      ) : null}

      {data && !state.error ? (
        <>
          <Metrics
            items={[
              {
                label: 'Affected orders',
                value: data.affected_order_count,
                hint: 'Source event orders included',
              },
              {
                label: 'Affected lines',
                value: affectedLines,
                hint: 'Order lines in graph',
              },
              {
                label: 'Longest path',
                value: pluralize(maxSteps, 'hop'),
                hint: 'Shortest hops',
              },
            ]}
          />

          <GraphFlags graph={data} />

          <section className="panel">
              <header className="panel__head">
                <div>
                  <h2>Propagation graph</h2>
                  <p>
                    Selected event on the left; each column is one more hop downstream.
                    {data.orders.length > 1
                      ? ` Rows follow the affected orders, top to bottom: ${data.orders
                          .map((order) => order.order_number)
                          .join(', ')}.`
                      : data.orders.length === 1
                        ? ` The row follows affected order ${data.orders[0].order_number}.`
                        : ''}
                  </p>
                </div>
                <EdgeLegend edges={data.edges} />
              </header>
              {data.nodes.length === 0 ? (
                <EmptyState title="No nodes returned" />
              ) : (
                <>
                  <ImpactGraph data={data} />
                  {data.nodes.length === 1 ? (
                    <p className="panel__note">
                      No downstream event was reached from this event. The affected-order list may
                      still be non-empty because the source event itself is linked to orders.
                    </p>
                  ) : null}
                  <div className="page-actions">
                    <Link
                      className="btn btn--ghost btn--sm"
                      to={`/events/${data.selected_event_id}/root-cause${rootCauseOrderQuery}`}
                    >
                      Trace root cause of event #{data.selected_event_id}
                      <ArrowRightIcon size={14} />
                    </Link>
                  </div>
                  <p className="panel__note">
                    Edges run cause → effect. Hops are shortest distances to each line's latest
                    affected event.
                  </p>
                </>
              )}
          </section>

          <div className="impact-bottom">
            <section className="panel">
                <header className="panel__head">
                  <div>
                    <h2>Affected orders</h2>
                    <p>Order lines touched by any event in this graph.</p>
                  </div>
                </header>
                {data.orders.length === 0 ? (
                  <EmptyState title="No affected orders">
                    <p>
                      This event is not linked to an order directly, and no downstream event reaches
                      an order line.
                    </p>
                  </EmptyState>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table orders-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Customer</th>
                          <th>Line</th>
                          <th>Commitment</th>
                          <th>Latest event</th>
                          <th className="num">Hops</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders.flatMap((order) => {
                          if (order.lines.length === 0) {
                            return [
                              <tr key={`${order.order_id}-empty`}>
                                <td>
                                  <Link
                                    className="text-link mono"
                                    to={`/orders/${encodeURIComponent(order.order_number)}`}
                                  >
                                    {order.order_number}
                                  </Link>
                                </td>
                                <td>{order.customer_name}</td>
                                <td className="muted">—</td>
                                <td className="muted">—</td>
                                <td className="muted">—</td>
                                <td className="num muted">—</td>
                              </tr>,
                            ]
                          }

                          return order.lines.map((line, index) => (
                            <tr key={line.order_line_id}>
                              {index === 0 ? (
                                <>
                                  <td rowSpan={order.lines.length}>
                                    <Link
                                      className="text-link mono"
                                      to={`/orders/${encodeURIComponent(order.order_number)}`}
                                    >
                                      {order.order_number}
                                    </Link>
                                  </td>
                                  <td rowSpan={order.lines.length}>{order.customer_name}</td>
                                </>
                              ) : null}
                              <td title={`Order line id ${line.order_line_id}`}>
                                #{line.line_number}
                              </td>
                              <td className="mono">{line.current_commitment ?? '—'}</td>
                              <td>
                                <Link
                                  className="text-link mono"
                                  to={`/events/${line.latest_affected_event_id}/root-cause?order=${encodeURIComponent(order.order_number)}`}
                                  title={formatUtc(line.latest_affected_event_time)}
                                >
                                  #{line.latest_affected_event_id}
                                </Link>
                              </td>
                              <td className="num">{line.causal_hops}</td>
                            </tr>
                          ))
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
