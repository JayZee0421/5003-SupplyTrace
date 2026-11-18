import type { EventStatus } from './types'

export interface DemoScenario {
  id: string
  name: string
  summary: string
  rootEventId: number
  rootEventType: string
  rootStatus: Extract<EventStatus, 'WARNING' | 'FAILED'>
  traceFromEventId: number
  chainStartEventId: number
  impactedOrders: string[]
  timelineOrder: string
}

// Single source for the demo navigation. `demo.test.ts` verifies these ids and
// orders against benchmark_cases.json so the frontend cannot drift from the
// backend benchmark set.
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'supplier-delay',
    name: 'Supplier delay',
    summary: 'Supplier misses its confirmation window; two orders slip.',
    rootEventId: 3,
    rootEventType: 'SUPPLIER_DELAYED',
    rootStatus: 'WARNING',
    traceFromEventId: 10,
    chainStartEventId: 1,
    impactedOrders: ['SO-SYN-000001', 'SO-SYN-000002'],
    timelineOrder: 'SO-SYN-000001',
  },
  {
    id: 'quality-failure',
    name: 'Quality failure',
    summary: 'Quality check fails; a re-check pushes two orders.',
    rootEventId: 23,
    rootEventType: 'QUALITY_CHECK',
    rootStatus: 'FAILED',
    traceFromEventId: 29,
    chainStartEventId: 20,
    impactedOrders: ['SO-SYN-000003', 'SO-SYN-000004'],
    timelineOrder: 'SO-SYN-000003',
  },
  {
    id: 'transport-disruption',
    name: 'Transport disruption',
    summary: 'Shipment disrupted in transit; two deliveries move downstream.',
    rootEventId: 46,
    rootEventType: 'TRANSPORT_DISRUPTION',
    rootStatus: 'WARNING',
    traceFromEventId: 48,
    chainStartEventId: 39,
    impactedOrders: ['SO-SYN-000005', 'SO-SYN-000006'],
    timelineOrder: 'SO-SYN-000005',
  },
]

const primaryScenario = DEMO_SCENARIOS[0]

/**
 * Demo-only order watchlist for the home exception queue. When a real order
 * source is connected, pass the server-provided order list to
 * `useRecentExceptions` instead of relying on this constant.
 */
export const DEMO_ORDER_NUMBERS = Array.from(
  new Set(
    DEMO_SCENARIOS.flatMap((scenario) => [
      scenario.timelineOrder,
      ...scenario.impactedOrders,
    ]),
  ),
)

export const DEFAULT_ORDER = primaryScenario.timelineOrder
export const DEFAULT_TRACE_EVENT = primaryScenario.traceFromEventId
export const DEFAULT_IMPACT_EVENT = primaryScenario.rootEventId
export const ORDER_SEARCH_PLACEHOLDER = DEFAULT_ORDER
export const EVENT_SEARCH_PLACEHOLDER = `Event id, e.g. ${DEFAULT_TRACE_EVENT}`
