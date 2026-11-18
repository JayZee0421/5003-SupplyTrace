import { fetchTimeline, MOCK_MODE } from '../api/client'
import { BENCHMARK_DATASET, DEMO_SEED } from '../config'
import { DEFAULT_ORDER, DEMO_SCENARIOS } from '../demo'
import { useApi } from '../hooks/useApi'
import { formatNumber } from '../lib/format'
import { AlertTriangleIcon, CheckCircleIcon } from './icons'

const scenario = DEMO_SCENARIOS[0]

/** Confirms the benchmark order is reachable before a live demo. */
export function DemoReadiness() {
  const state = useApi(`demo-readiness:${DEFAULT_ORDER}`, (signal) =>
    fetchTimeline(DEFAULT_ORDER, signal),
  )

  if (MOCK_MODE) {
    return (
      <p className="demo-readiness demo-readiness--ready">
        <CheckCircleIcon size={14} />
        Mock fixtures loaded: {scenario.name.toLowerCase()} path
      </p>
    )
  }

  if (state.loading && !state.data) {
    return <p className="demo-readiness">Checking demo data...</p>
  }

  if (state.error) {
    return (
      <p className="demo-readiness demo-readiness--error" role="status">
        <AlertTriangleIcon size={14} />
        Demo data unavailable. Start the API and load {BENCHMARK_DATASET}.
      </p>
    )
  }

  const events = state.data?.events ?? []
  const hasBenchmarkEvents =
    events.some((event) => event.event_id === scenario.rootEventId) &&
    events.some((event) => event.event_id === scenario.traceFromEventId)

  if (!hasBenchmarkEvents) {
    return (
      <p className="demo-readiness demo-readiness--error" role="status">
        <AlertTriangleIcon size={14} />
        {`Order ${DEFAULT_ORDER} is reachable, but benchmark events #${scenario.rootEventId} and #${scenario.traceFromEventId} are missing. Load ${BENCHMARK_DATASET} or the seed-${DEMO_SEED} dataset.`}
      </p>
    )
  }

  return (
    <p className="demo-readiness demo-readiness--ready" role="status">
      <CheckCircleIcon size={14} />
      {`Demo data loaded: ${DEFAULT_ORDER}, ${formatNumber(events.length)} events, exceptions #${scenario.rootEventId}/#${scenario.traceFromEventId}`}
    </p>
  )
}
