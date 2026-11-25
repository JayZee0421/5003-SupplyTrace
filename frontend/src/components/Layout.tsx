import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { fetchHealth, MOCK_MODE } from '../api/client'
import { HEALTH_POLL_MS } from '../config'
import {
  DEMO_SCENARIOS,
  DEFAULT_IMPACT_EVENT,
  DEFAULT_ORDER,
  DEFAULT_TRACE_EVENT,
} from '../demo'
import { useOrderPage } from '../context/OrderPageContext'
import {
  parsePathContext,
  resolveNavigation,
  resolveStoredContext,
  type NavContext,
} from '../lib/nav'
import { DisplayMenu } from './DisplayMenu'
import { ErrorBoundary } from './ErrorBoundary'
import { LogoIcon } from './icons'

const demoScenario = DEMO_SCENARIOS[0]
const LAST_CONTEXT_KEY = 'supplytrace:last-context'

function readStoredContext(): NavContext | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_CONTEXT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NavContext>
    const eventId =
      typeof parsed.eventId === 'number' &&
      Number.isInteger(parsed.eventId) &&
      parsed.eventId > 0
        ? parsed.eventId
        : null
    const order = typeof parsed.order === 'string' && parsed.order ? parsed.order : null
    const eventOrder =
      typeof parsed.eventOrder === 'string' && parsed.eventOrder ? parsed.eventOrder : null
    return eventId === null && order === null && eventOrder === null
      ? null
      : { eventId, order, eventOrder }
  } catch {
    return null
  }
}

function writeStoredContext(context: NavContext) {
  try {
    window.sessionStorage.setItem(LAST_CONTEXT_KEY, JSON.stringify(context))
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

type HealthState = 'checking' | 'live' | 'offline'

function HealthPill() {
  const [state, setState] = useState<HealthState>(MOCK_MODE ? 'live' : 'checking')

  useEffect(() => {
    if (MOCK_MODE) return
    let active = true
    let controller: AbortController | null = null

    const run = () => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      fetchHealth(current.signal)
        .then(() => {
          if (active && !current.signal.aborted) setState('live')
        })
        .catch((error: unknown) => {
          if (!active || current.signal.aborted) return
          if (error instanceof Error && error.name === 'AbortError') return
          setState('offline')
        })
    }

    run()
    const interval = window.setInterval(run, HEALTH_POLL_MS)
    return () => {
      active = false
      window.clearInterval(interval)
      controller?.abort()
    }
  }, [])

  const label = MOCK_MODE
    ? 'Mock data'
    : state === 'live'
      ? 'API live'
      : state === 'offline'
        ? 'API offline'
        : 'Checking API'

  const tone = MOCK_MODE ? 'mock' : state

  return (
    <span
      className={`health health--${tone}`}
      title={
        MOCK_MODE
          ? 'Bundled fixtures are used instead of the API'
          : 'Backend health check, refreshed every 30 seconds'
      }
    >
      <span className="health__dot" aria-hidden="true" />
      {label}
    </span>
  )
}

export function Layout() {
  const location = useLocation()
  const { order: orderPageOrder, latestEventId: orderPageEventId } = useOrderPage()

  // Keep the current order/event while switching views. Fall back to the
  // scenario that contains the current order, then to the demo defaults.
  const pathContext = parsePathContext(location.pathname)
  const currentEventId = pathContext.eventId
  const currentOrder = pathContext.order
  const contextOrder = new URLSearchParams(location.search).get('order') || null
  // Demo scenario metadata is only a fallback for the seeded walkthrough.
  // Real orders are anchored by the URL context or the order page's timeline.
  const relatedScenario = DEMO_SCENARIOS.find((scenario) =>
    currentEventId !== null
      ? scenario.rootEventId === currentEventId || scenario.traceFromEventId === currentEventId
      : currentOrder !== null
        ? scenario.timelineOrder === currentOrder || scenario.impactedOrders.includes(currentOrder)
        : false,
  )

  // Remember the last explicit context as one coherent event/order pair so
  // Overview and Durations do not jump back to the demo defaults after a drill-down.
  const initialLastContext = useMemo(() => readStoredContext(), [])
  const lastContextRef = useRef<NavContext | null>(initialLastContext)

  useEffect(() => {
    const next = resolveStoredContext({
      currentEventId,
      currentOrder,
      contextOrder,
      scenario: relatedScenario,
      orderPageOrder,
      orderPageEventId,
      previous: lastContextRef.current,
    })
    if (!next) return
    lastContextRef.current = next
    writeStoredContext(next)
  }, [
    currentEventId,
    currentOrder,
    contextOrder,
    relatedScenario,
    orderPageOrder,
    orderPageEventId,
  ])

  const resolvedNavigation = resolveNavigation({
    currentEventId,
    currentOrder,
    contextOrder,
    scenario: relatedScenario,
    lastContext: lastContextRef.current,
    orderPageOrder,
    orderPageEventId,
    defaultOrder: DEFAULT_ORDER,
    defaultTraceEvent: DEFAULT_TRACE_EVENT,
    defaultImpactEvent: DEFAULT_IMPACT_EVENT,
  })
  const navOrder = resolvedNavigation.order
  const activePath = (location.pathname.replace(/\/+$/, '') || '/').toLowerCase()

  const navigation = [
    { to: '/', label: 'Overview', active: activePath === '/' },
    {
      to: resolvedNavigation.orderKnown
        ? `/orders/${encodeURIComponent(navOrder)}`
        : null,
      label: 'Timeline',
      active: activePath.startsWith('/orders/'),
    },
    {
      to: resolvedNavigation.rootCauseHref,
      label: 'Root cause',
      active: /^\/events\/\d+\/root-cause/.test(activePath),
    },
    {
      to: resolvedNavigation.impactHref,
      label: 'Impact',
      active: /^\/events\/\d+\/impact/.test(activePath),
    },
    { to: '/durations', label: 'Durations', active: activePath === '/durations' },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand" aria-label="SupplyTrace home">
            <LogoIcon size={32} />
            <span className="brand__name">SupplyTrace</span>
          </Link>
          <nav className="nav" aria-label="Main views">
            {navigation.map((item) =>
              item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className={item.active ? 'nav__link nav__link--active' : 'nav__link'}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  className="nav__link nav__link--disabled"
                  aria-disabled="true"
                  title="Order number unavailable for this event"
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>
          <div className="header-tools">
            <HealthPill />
            <DisplayMenu />
          </div>
        </div>
      </header>
      {MOCK_MODE ? (
        <div className="mock-banner" role="status">
          {`Mock mode is on. Bundled path: orders ${demoScenario.timelineOrder}/${
            demoScenario.impactedOrders[1] ?? demoScenario.timelineOrder
          }, root cause #${demoScenario.traceFromEventId}/#${demoScenario.rootEventId}, impact #${
            demoScenario.rootEventId
          }. Start the API for all ${DEMO_SCENARIOS.length} scenarios and for duration filters.`}
        </div>
      ) : null}
      <main className="page">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="app-footer">
        <span>SupplyTrace · DSC5003 course project</span>
        <span>All event times are shown in UTC. Durations are in hours.</span>
      </footer>
    </div>
  )
}
