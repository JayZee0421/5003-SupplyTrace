import { Link, useNavigate } from 'react-router-dom'
import { BENCHMARK_EVENT_COUNT, LARGE_EVENT_COUNT } from '../config'
import { DEMO_SCENARIOS, DEFAULT_TRACE_EVENT } from '../demo'
import { DemoReadiness } from '../components/DemoReadiness'
import { RecentExceptions } from '../components/RecentExceptions'
import { SearchBar } from '../components/SearchBar'
import { StatusDot } from '../components/StatusBadge'
import { TracePreview } from '../components/TracePreview'
import { useRecentExceptions } from '../hooks/useRecentExceptions'
import { ArrowRightIcon } from '../components/icons'

const primaryScenario = DEMO_SCENARIOS[0]

export function HomePage() {
  const navigate = useNavigate()
  const recent = useRecentExceptions()
  const latest = recent.exceptions[0]

  return (
    <div className="home">
      <section className="hero">
        <div className="hero__body">
          <h1 className="hero__title">
            Trace a <span className="nowrap">supply-chain</span>
            <br className="hero__break-sm" />
            {' '}event{' '}
            <br className="hero__break-lg" />
            from root cause to impact
          </h1>
          <p className="hero__subtitle">
            Order timelines, cause chains, downstream impact and stage durations, from one{' '}
            <span className="nowrap">supply-chain</span> event log.
          </p>
          <SearchBar
            kind="order"
            initialValue=""
            buttonLabel="Open timeline"
            onSearch={(value) => navigate(`/orders/${encodeURIComponent(value)}`)}
          />
          <div className="hero__links">
            {recent.loading ? (
              <span className="hero__trace-link muted">Checking latest exception...</span>
            ) : latest ? (
              <Link
                className="text-link hero__trace-link"
                to={`/events/${latest.event.event_id}/root-cause?order=${encodeURIComponent(latest.orderNumber)}`}
              >
                {recent.failedCount > 0 ? 'Latest loaded exception' : 'Latest exception'}: event #
                {latest.event.event_id} ({latest.event.event_type_code})
                <ArrowRightIcon size={14} />
              </Link>
            ) : (
              <Link
                className="text-link hero__trace-link"
                to={`/events/${DEFAULT_TRACE_EVENT}/root-cause`}
              >
                Open demo root cause (event #{DEFAULT_TRACE_EVENT})
                <ArrowRightIcon size={14} />
              </Link>
            )}
          </div>
        </div>
        <TracePreview scenario={primaryScenario} />
      </section>

      <RecentExceptions state={recent} scopeLabel="the seeded benchmark orders" />

      <div className="home-lower">
        <section className="home-scenarios" aria-labelledby="scenarios-heading">
          <div className="section__head">
            <div>
              <h2 id="scenarios-heading">Demo scenarios</h2>
              <p>Seeded disruptions. Each opens the same event ids in both datasets.</p>
            </div>
          </div>
          <div className="table-wrap scenario-table-wrap">
            <table className="scenario-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Root event</th>
                  <th>Affected orders</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_SCENARIOS.map((scenario) => (
                  <tr key={scenario.id}>
                    <td className="scenario-table__case">
                      <div className="scenario-table__name">
                        <StatusDot status={scenario.rootStatus} />
                        <span>{scenario.name}</span>
                      </div>
                      <p>{scenario.summary}</p>
                    </td>
                    <td className="scenario-table__root">
                      <span className="mono">#{scenario.rootEventId}</span>
                      <span className="mono muted">{scenario.rootEventType}</span>
                    </td>
                    <td className="scenario-table__orders mono">
                      {scenario.impactedOrders.join(' · ')}
                    </td>
                    <td className="scenario-table__actions">
                      <Link to={`/orders/${scenario.timelineOrder}`}>Timeline</Link>
                      <Link to={`/events/${scenario.traceFromEventId}/root-cause`}>Root cause</Link>
                      <Link to={`/events/${scenario.rootEventId}/impact`}>Impact</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="home-footnote">
            {`Event ids match benchmark_cases.json in the ${BENCHMARK_EVENT_COUNT}-event and ${LARGE_EVENT_COUNT / 1000}k seeded datasets.`}
          </p>
        </section>

        <aside className="home-guide">
          <h2>Demo walkthrough</h2>
          <p className="home-guide__sub">Follow one seeded path through the four views.</p>
          <ol className="flow flow--stacked">
            <li>
              <span className="flow__step mono">1</span>
              <Link to={`/orders/${primaryScenario.timelineOrder}`}>
                Open {primaryScenario.timelineOrder}
              </Link>
            </li>
            <li>
              <span className="flow__step mono">2</span>
              <Link to={`/events/${primaryScenario.traceFromEventId}/root-cause`}>
                Root cause of event #{primaryScenario.traceFromEventId}
              </Link>
            </li>
            <li>
              <span className="flow__step mono">3</span>
              <Link to={`/events/${primaryScenario.rootEventId}/impact`}>
                Impact of #{primaryScenario.rootEventId}
              </Link>
            </li>
            <li>
              <span className="flow__step mono">4</span>
              <Link to="/durations">Stage durations</Link>
            </li>
          </ol>
          <DemoReadiness />
        </aside>
      </div>
    </div>
  )
}
