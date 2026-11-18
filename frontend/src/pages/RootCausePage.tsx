import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ApiError, fetchRootCause } from '../api/client'
import { DEMO_SCENARIOS } from '../demo'
import { useApi } from '../hooks/useApi'
import { formatUtc, pluralize } from '../lib/format'
import { graphDepth, selectedNode } from '../lib/graph'
import { parsePositiveInt } from '../lib/ids'
import { EdgeLegend, RootCauseChain } from '../components/RootCauseChain'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { GraphFlags } from '../components/GraphFlags'
import { Loading } from '../components/Loading'
import { Metrics } from '../components/Metrics'
import { SearchBar } from '../components/SearchBar'
import { StatusBadge } from '../components/StatusBadge'
import { ArrowRightIcon } from '../components/icons'

function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function RootCausePage() {
  const { eventId: eventIdParam = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const eventId = parsePositiveInt(eventIdParam)
  const contextOrder = new URLSearchParams(location.search).get('order')

  const state = useApi(
    `root-cause:${eventId ?? `invalid:${eventIdParam}`}`,
    (signal) =>
      eventId !== null
        ? fetchRootCause(eventId, signal)
        : Promise.reject(
            new ApiError('Event id must be a positive integer.', 422, 'VALIDATION_ERROR'),
          ),
  )

  const data = state.data
  const selected = data ? selectedNode(data) : undefined
  const earliest = data?.nodes.find(
    (node) => node.event_id === data.earliest_exception_event_id,
  )
  const chainStart = data?.nodes.find((node) => node.event_id === data.chain_start_event_id)
  const maxSteps = data ? graphDepth(data) : 0
  const impactTarget = earliest?.event_id ?? selected?.event_id
  // Demo scenario metadata; real events fall back to the URL order or the
  // backend-provided order id.
  const scenarioOrder = DEMO_SCENARIOS.find(
    (scenario) =>
      scenario.rootEventId === selected?.event_id ||
      scenario.traceFromEventId === selected?.event_id,
  )?.timelineOrder
  const orderLabel =
    scenarioOrder ??
    contextOrder ??
    (selected && selected.order_id !== null ? `#${selected.order_id}` : '—')
  const navigationOrder = contextOrder ?? scenarioOrder
  const orderQuery = navigationOrder ? `?order=${encodeURIComponent(navigationOrder)}` : ''
  const orderLine = selected
    ? `${orderLabel} / ${
        selected.order_line_id !== null ? `#${selected.order_line_id}` : '—'
      }`
    : '—'

  return (
    <div>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title">Event #{eventId ?? eventIdParam}</h1>
          <p className="page-subtitle">
            {selected
              ? `${selected.event_name} · ${formatUtc(selected.event_time)}`
              : 'Follow caused_by links back to the earliest observed exception'}
          </p>
        </div>
        <SearchBar
          kind="event"
          initialValue={eventId !== null ? String(eventId) : ''}
          buttonLabel="Trace"
          onSearch={(value) => navigate(`/events/${value}/root-cause${orderQuery}`)}
        />
      </header>

      {state.loading && !data ? <Loading label="Loading cause chain" /> : null}

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} title="Root-cause trace unavailable">
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
                label: 'Nodes',
                value: data.count,
                hint: `Longest path ${pluralize(maxSteps, 'hop')}`,
              },
              {
                label: 'Earliest exception',
                value: earliest ? (
                  <Link to={`/events/${earliest.event_id}/root-cause${orderQuery}`}>
                    #{earliest.event_id}
                  </Link>
                ) : (
                  'None'
                ),
                hint: earliest ? earliest.event_type_code : 'No WARNING or FAILED event',
              },
              {
                label: 'Chain start',
                value: chainStart ? (
                  <Link to={`/events/${chainStart.event_id}/root-cause${orderQuery}`}>
                    #{chainStart.event_id}
                  </Link>
                ) : (
                  'Unknown'
                ),
                hint: chainStart
                  ? chainStart.event_type_code
                  : data.truncated
                    ? 'Depth limit reached'
                    : 'No parentless event',
              },
            ]}
          />

          <GraphFlags graph={data} />

          {data.nodes.length === 0 ? (
            <EmptyState title="No events returned for this chain" />
          ) : (
            <div className="detail-layout">
              <section className="panel">
                <header className="panel__head">
                  <div>
                    <h2>Cause chain</h2>
                    <p>
                      Causal order, not recency: earliest cause at the top, selected event at the
                      bottom.
                    </p>
                  </div>
                  <EdgeLegend edges={data.edges} />
                </header>
                <RootCauseChain data={data} orderQuery={orderQuery} />
                {data.nodes.length === 1 ? (
                  <p className="panel__note">
                    No upstream cause is recorded for this event. It is the start of its own chain.
                  </p>
                ) : null}
                <p className="panel__note">
                  Follows <span className="mono">caused_by_event_id</span> only. Earliest exception
                  = first WARNING/FAILED event by time and id in the returned chain.
                </p>
              </section>

              <aside className="detail-aside">
                <section className="panel">
                  <h2>Event context</h2>
                  <dl className="kv">
                    <KeyValue label="Status">
                      {selected ? <StatusBadge status={selected.status} size="sm" /> : '—'}
                    </KeyValue>
                    <KeyValue label="Event time">
                      <span className="mono">{selected ? formatUtc(selected.event_time) : '—'}</span>
                    </KeyValue>
                    <KeyValue label="Order / line">
                      <span className="mono">{orderLine}</span>
                    </KeyValue>
                    {selected?.message ? (
                      <KeyValue label="Message">{selected.message}</KeyValue>
                    ) : null}
                  </dl>
                  {impactTarget ? (
                    <Link
                      className="btn btn--primary btn--block"
                      to={`/events/${impactTarget}/impact${orderQuery}`}
                    >
                      View impact of event #{impactTarget}
                      <ArrowRightIcon size={15} />
                    </Link>
                  ) : null}
                </section>
              </aside>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
