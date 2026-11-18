import { describe, expect, it } from 'vitest'
import benchmarkCases from '../../benchmark_cases.json'
import { DEMO_SCENARIOS } from './demo'

interface BenchmarkCase {
  scenario: string
  root_event_id: number
  root_event_type: string
  root_status: string
  trace_from_event_id: number
  impacted_orders: string[]
}

const cases = benchmarkCases as BenchmarkCase[]

describe('demo scenario configuration', () => {
  it('matches benchmark_cases.json so the demo ids cannot drift', () => {
    expect(DEMO_SCENARIOS).toHaveLength(cases.length)

    for (const scenario of DEMO_SCENARIOS) {
      const benchmark = cases.find((item) => item.scenario === scenario.id.replace(/-/g, '_'))
      expect(benchmark, `missing benchmark case for ${scenario.id}`).toBeDefined()
      if (!benchmark) continue

      expect(scenario.rootEventId).toBe(benchmark.root_event_id)
      expect(scenario.rootEventType).toBe(benchmark.root_event_type)
      expect(scenario.rootStatus).toBe(benchmark.root_status)
      expect(scenario.traceFromEventId).toBe(benchmark.trace_from_event_id)
      expect(scenario.impactedOrders).toEqual(benchmark.impacted_orders)
      expect(scenario.timelineOrder).toBe(benchmark.impacted_orders[0])
    }
  })
})
