import { Link } from 'react-router-dom'
import { fetchTimeline } from '../api/client'
import type { DemoScenario } from '../demo'
import { useApi } from '../hooks/useApi'
import { sortEventsNewestFirst } from '../lib/events'
import { formatUtcShort } from '../lib/format'
import type { EventRecord } from '../types'
import { ArrowRightIcon } from './icons'
import { statusTone } from './StatusBadge'

/** Live preview of a demo scenario; deliberately not the latest exception. */
export function TracePreview({ scenario }: { scenario: DemoScenario }) {
  const state = useApi(`order-preview:${scenario.timelineOrder}`, (signal) =>
    fetchTimeline(scenario.timelineOrder, signal),
  )

  const timeline = state.data
  const events = timeline?.events ?? []
  const rootEvent = events.find((event) => event.event_id === scenario.rootEventId)
  const traceEvent = events.find((event) => event.event_id === scenario.traceFromEventId)
  const middleEvent = events[Math.floor(events.length * 0.65)]
  const previewEvents = sortEventsNewestFirst(
    Array.from(
      new Map(
        [events[0], rootEvent, middleEvent, traceEvent]
          .filter((event): event is EventRecord => event !== undefined)
          .map((event) => [event.event_id, event]),
      ).values(),
    ),
  )

  const orderNumber = timeline?.order_number ?? scenario.timelineOrder
  const linkTarget = `/events/${scenario.traceFromEventId}/root-cause`

  return (
    <div
      className="trace-preview"
      aria-label={`Demo preview: ${scenario.name} scenario, order ${orderNumber}`}
    >
      <header className="trace-preview__head">
        <span className="trace-preview__label">Demo preview · {scenario.name}</span>
        <span className="trace-preview__order mono">{orderNumber}</span>
      </header>

      {state.loading && !timeline ? (
        <p className="trace-preview__state">Loading timeline...</p>
      ) : null}

      {!state.loading && state.error ? (
        <p className="trace-preview__state">Preview unavailable.</p>
      ) : null}

      {timeline && !state.error ? (
        <>
          <ol className="trace-preview__path">
            {previewEvents.map((step) => {
              const tag =
                step.event_id === scenario.rootEventId
                  ? 'Earliest exception'
                  : step.is_exception
                    ? step.status === 'FAILED'
                      ? 'Failed'
                      : 'Warning'
                    : null
              return (
                <li
                  className={`preview-step preview-step--${statusTone(step.status)}`}
                  key={step.event_id}
                >
                  <span className="preview-step__dot" aria-hidden="true" />
                  <div className="preview-step__body">
                    <div className="preview-step__top">
                      <span className="mono">
                        #{step.event_id} · {step.event_type_code}
                      </span>
                      {tag ? <span className="preview-step__tag">{tag}</span> : null}
                    </div>
                    <p className="preview-step__name">{step.event_name}</p>
                    <p className="preview-step__meta">
                      {step.subject_entity} · {formatUtcShort(step.event_time)} UTC
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
          <footer className="trace-preview__foot">
            <span className="trace-preview__stats">
              <span>
                <strong>{scenario.impactedOrders.length}</strong>{' '}
                {scenario.impactedOrders.length === 1 ? 'order' : 'orders'} affected by root cause{' '}
                <strong>#{scenario.rootEventId}</strong>
              </span>
            </span>
            <Link className="text-link" to={linkTarget}>
              Open trace for #{scenario.traceFromEventId} <ArrowRightIcon size={13} />
            </Link>
          </footer>
        </>
      ) : null}
    </div>
  )
}
