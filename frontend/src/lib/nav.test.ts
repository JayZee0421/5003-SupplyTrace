import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMPACT_EVENT,
  DEFAULT_ORDER,
  DEFAULT_TRACE_EVENT,
  DEMO_SCENARIOS,
} from '../demo'
import {
  parsePathContext,
  resolveNavigation,
  resolveStoredContext,
  type NavigationInput,
  type StoredContextInput,
} from './nav'

const supplier = DEMO_SCENARIOS[0]
const transport = DEMO_SCENARIOS[2]

const baseNavigation: NavigationInput = {
  currentEventId: null,
  currentOrder: null,
  contextOrder: null,
  scenario: undefined,
  lastContext: null,
  orderPageOrder: null,
  orderPageEventId: null,
  defaultOrder: DEFAULT_ORDER,
  defaultTraceEvent: DEFAULT_TRACE_EVENT,
  defaultImpactEvent: DEFAULT_IMPACT_EVENT,
}

const baseStored: StoredContextInput = {
  currentEventId: null,
  currentOrder: null,
  contextOrder: null,
  scenario: undefined,
  orderPageOrder: null,
  orderPageEventId: null,
  previous: null,
}

function navigate(overrides: Partial<NavigationInput>) {
  return resolveNavigation({ ...baseNavigation, ...overrides })
}

function store(overrides: Partial<StoredContextInput>) {
  return resolveStoredContext({ ...baseStored, ...overrides })
}

describe('resolveNavigation', () => {
  it('uses the demo fallbacks on a first visit', () => {
    expect(navigate({})).toEqual({
      order: DEFAULT_ORDER,
      orderKnown: true,
      rootCauseEvent: DEFAULT_TRACE_EVENT,
      impactEvent: DEFAULT_IMPACT_EVENT,
      rootCauseHref: `/events/${DEFAULT_TRACE_EVENT}/root-cause`,
      impactHref: `/events/${DEFAULT_IMPACT_EVENT}/impact`,
    })
  })

  it('keeps an explicitly viewed event and order', () => {
    const result = navigate({
      currentEventId: 57,
      contextOrder: 'SO-SYN-000006',
    })

    expect(result.order).toBe('SO-SYN-000006')
    expect(result.rootCauseEvent).toBe(57)
    expect(result.impactEvent).toBe(57)
    expect(result.rootCauseHref).toBe('/events/57/root-cause?order=SO-SYN-000006')
    expect(result.impactHref).toBe('/events/57/impact?order=SO-SYN-000006')
  })

  it('reuses the last context on Overview/Durations', () => {
    const result = navigate({
      lastContext: {
        eventId: 57,
        order: 'SO-SYN-000006',
        eventOrder: 'SO-SYN-000006',
      },
    })

    expect(result.order).toBe('SO-SYN-000006')
    expect(result.rootCauseHref).toBe('/events/57/root-cause?order=SO-SYN-000006')
    expect(result.impactHref).toBe('/events/57/impact?order=SO-SYN-000006')
  })

  it('anchors an order page to its own latest exception', () => {
    const result = navigate({
      currentOrder: 'SO-SYN-000006',
      scenario: transport,
      orderPageOrder: 'SO-SYN-000006',
      orderPageEventId: 57,
    })

    expect(result.order).toBe('SO-SYN-000006')
    expect(result.rootCauseEvent).toBe(57)
    expect(result.impactEvent).toBe(57)
    expect(result.rootCauseHref).toBe('/events/57/root-cause?order=SO-SYN-000006')
  })

  it('keeps a previously viewed event when entering its order timeline', () => {
    const result = navigate({
      currentOrder: 'SO-SYN-000006',
      scenario: transport,
      lastContext: {
        eventId: 57,
        order: 'SO-SYN-000006',
        eventOrder: 'SO-SYN-000006',
      },
      orderPageEventId: 57,
    })

    expect(result.rootCauseEvent).toBe(57)
    expect(result.impactEvent).toBe(57)
  })

  it('falls back to the scenario only before order data arrives', () => {
    const result = navigate({
      currentOrder: 'SO-SYN-000006',
      scenario: transport,
      orderPageOrder: 'SO-SYN-000006',
      orderPageEventId: null,
    })

    expect(result.order).toBe('SO-SYN-000006')
    expect(result.rootCauseEvent).toBe(transport.rootEventId)
    expect(result.impactEvent).toBe(transport.rootEventId)
    expect(result.rootCauseHref).toBe(
      `/events/${transport.rootEventId}/root-cause?order=SO-SYN-000006`,
    )
  })

  it('uses the impacted order itself for scenario fallback links', () => {
    const result = navigate({
      currentOrder: 'SO-SYN-000002',
      scenario: supplier,
      orderPageOrder: 'SO-SYN-000002',
      orderPageEventId: 19,
    })

    expect(result.rootCauseEvent).toBe(19)
    expect(result.impactEvent).toBe(19)
    expect(result.rootCauseHref).toBe('/events/19/root-cause?order=SO-SYN-000002')
  })

  it('does not invent an order for a bare non-scenario event link', () => {
    const result = navigate({ currentEventId: 19 })

    expect(result.order).toBe(DEFAULT_ORDER)
    expect(result.orderKnown).toBe(false)
    expect(result.rootCauseEvent).toBe(19)
    expect(result.impactEvent).toBe(19)
    expect(result.rootCauseHref).toBe('/events/19/root-cause')
    expect(result.impactHref).toBe('/events/19/impact')
  })

  it('uses the stored order for a bare link to the same event', () => {
    const result = navigate({
      currentEventId: 19,
      lastContext: {
        eventId: 19,
        order: 'SO-SYN-000002',
        eventOrder: 'SO-SYN-000002',
      },
    })

    expect(result.order).toBe('SO-SYN-000002')
    expect(result.orderKnown).toBe(true)
    expect(result.rootCauseHref).toBe('/events/19/root-cause?order=SO-SYN-000002')
    expect(result.impactHref).toBe('/events/19/impact?order=SO-SYN-000002')
  })

  it('does not attach an unknown order to fallback demo events', () => {
    const result = navigate({ currentOrder: 'DOES-NOT-EXIST' })

    expect(result.order).toBe('DOES-NOT-EXIST')
    expect(result.rootCauseHref).toBe(`/events/${DEFAULT_TRACE_EVENT}/root-cause`)
    expect(result.impactHref).toBe(`/events/${DEFAULT_IMPACT_EVENT}/impact`)
  })

  it('does not attach an order that was stored without an event', () => {
    const result = navigate({
      currentOrder: 'DOES-NOT-EXIST',
      lastContext: { eventId: null, order: 'DOES-NOT-EXIST', eventOrder: null },
    })

    expect(result.rootCauseHref).toBe(`/events/${DEFAULT_TRACE_EVENT}/root-cause`)
    expect(result.impactHref).toBe(`/events/${DEFAULT_IMPACT_EVENT}/impact`)
  })

  it('maps a scenario event without a query to its scenario order', () => {
    const result = navigate({ currentEventId: 10, scenario: supplier })

    expect(result.order).toBe('SO-SYN-000001')
    expect(result.rootCauseHref).toBe('/events/10/root-cause?order=SO-SYN-000001')
    expect(result.impactHref).toBe('/events/10/impact?order=SO-SYN-000001')
  })
})

describe('parsePathContext', () => {
  it('accepts trailing slashes and case-insensitive routes', () => {
    expect(parsePathContext('/orders/SO-SYN-000002/')).toEqual({
      eventId: null,
      order: 'SO-SYN-000002',
    })
    expect(parsePathContext('/Events/57/impact')).toEqual({
      eventId: 57,
      order: null,
    })
  })

  it('returns empty context for other pages', () => {
    expect(parsePathContext('/durations')).toEqual({ eventId: null, order: null })
  })

  it('does not throw on a malformed percent escape', () => {
    expect(parsePathContext('/orders/%E0%A4%A')).toEqual({
      eventId: null,
      order: '%E0%A4%A',
    })
  })
})

describe('resolveStoredContext', () => {
  it('stores an event together with its order', () => {
    expect(
      store({ currentEventId: 57, contextOrder: 'SO-SYN-000006' }),
    ).toEqual({
      eventId: 57,
      order: 'SO-SYN-000006',
      eventOrder: 'SO-SYN-000006',
    })
  })

  it('uses the scenario order when an event has no query', () => {
    expect(store({ currentEventId: 10, scenario: supplier })).toEqual({
      eventId: 10,
      order: 'SO-SYN-000001',
      eventOrder: 'SO-SYN-000001',
    })
  })

  it('does not overwrite the last context for an unverified bare event', () => {
    expect(
      store({
        currentEventId: 19,
        previous: {
          eventId: 57,
          order: 'SO-SYN-000006',
          eventOrder: 'SO-SYN-000006',
        },
      }),
    ).toBeNull()
  })

  it('stores the order page latest exception once the timeline loads', () => {
    expect(
      store({
        currentOrder: 'SO-SYN-000006',
        scenario: transport,
        orderPageOrder: 'SO-SYN-000006',
        orderPageEventId: 57,
      }),
    ).toEqual({
      eventId: 57,
      order: 'SO-SYN-000006',
      eventOrder: 'SO-SYN-000006',
    })
  })

  it('keeps a previously viewed event in the same order', () => {
    expect(
      store({
        currentOrder: 'SO-SYN-000006',
        scenario: transport,
        previous: {
          eventId: 57,
          order: 'SO-SYN-000006',
          eventOrder: 'SO-SYN-000006',
        },
      }),
    ).toEqual({
      eventId: 57,
      order: 'SO-SYN-000006',
      eventOrder: 'SO-SYN-000006',
    })
  })

  it('remembers only the order before its timeline arrives', () => {
    expect(
      store({
        currentOrder: 'SO-SYN-000006',
        scenario: transport,
        orderPageOrder: 'SO-SYN-000006',
        orderPageEventId: null,
      }),
    ).toEqual({ eventId: null, order: 'SO-SYN-000006', eventOrder: null })
  })

  it('does not persist demo defaults for another order', () => {
    expect(
      store({
        currentOrder: 'SO-SYN-000002',
        scenario: supplier,
        previous: {
          eventId: 57,
          order: 'SO-SYN-000006',
          eventOrder: 'SO-SYN-000006',
        },
        orderPageEventId: 19,
        orderPageOrder: 'SO-SYN-000002',
      }),
    ).toEqual({
      eventId: 19,
      order: 'SO-SYN-000002',
      eventOrder: 'SO-SYN-000002',
    })
  })
})
