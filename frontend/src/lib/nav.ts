import type { DemoScenario } from '../demo'

export interface NavContext {
  eventId: number | null
  order: string | null
  eventOrder: string | null
}

export interface NavigationInput {
  currentEventId: number | null
  currentOrder: string | null
  contextOrder: string | null
  scenario?: DemoScenario
  lastContext: NavContext | null
  orderPageOrder: string | null
  orderPageEventId: number | null
  defaultOrder: string
  defaultTraceEvent: number
  defaultImpactEvent: number
}

export interface NavigationResult {
  order: string
  rootCauseEvent: number
  impactEvent: number
  rootCauseHref: string
  impactHref: string
}

/**
 * Resolves the global navigation from the URL, the demo scenario metadata and
 * the last coherent context. No order number or event id is hard-coded here.
 */
export function resolveNavigation(input: NavigationInput): NavigationResult {
  const {
    currentEventId,
    currentOrder,
    contextOrder,
    scenario,
    lastContext,
    orderPageOrder,
    orderPageEventId,
    defaultOrder,
    defaultTraceEvent,
    defaultImpactEvent,
  } = input

  const fallbackEvent = lastContext?.eventId ?? null
  const fallbackOrder = lastContext?.order ?? null
  const lastForOrder =
    currentOrder !== null && lastContext?.order === currentOrder ? lastContext : null
  const orderPageEvent =
    currentOrder !== null && orderPageOrder === currentOrder ? orderPageEventId : null

  const storedForEvent =
    currentEventId !== null && lastContext?.eventId === currentEventId
      ? lastContext.order
      : null
  const order =
    currentOrder ??
    contextOrder ??
    scenario?.timelineOrder ??
    storedForEvent ??
    (currentEventId === null ? fallbackOrder : null) ??
    defaultOrder

  const rootCauseEvent =
    currentEventId ??
    lastForOrder?.eventId ??
    orderPageEvent ??
    (scenario
      ? currentOrder !== null && currentOrder !== scenario.timelineOrder
        ? scenario.rootEventId
        : scenario.traceFromEventId
      : currentOrder === null && contextOrder === null
        ? fallbackEvent ?? defaultTraceEvent
        : defaultTraceEvent)

  const impactEvent =
    currentEventId ??
    lastForOrder?.eventId ??
    orderPageEvent ??
    scenario?.rootEventId ??
    (currentOrder === null && contextOrder === null
      ? fallbackEvent ?? defaultImpactEvent
      : defaultImpactEvent)

  const hasOrderAnchor =
    currentOrder !== null &&
    (scenario !== undefined || lastForOrder?.eventId != null || orderPageEvent !== null)

  const eventOrderFor = (eventId: number): string | null => {
    if (eventId === currentEventId) {
      return (
        contextOrder ??
        scenario?.timelineOrder ??
        (lastContext?.eventId === eventId ? lastContext.order : null)
      )
    }
    if (currentOrder !== null) return hasOrderAnchor ? currentOrder : null
    if (lastContext?.eventId === eventId) return lastContext.order
    if (
      scenario &&
      (eventId === scenario.rootEventId || eventId === scenario.traceFromEventId)
    ) {
      return scenario.timelineOrder
    }
    return null
  }

  const eventQuery = (eventId: number) => {
    const orderNumber = eventOrderFor(eventId)
    return orderNumber ? `?order=${encodeURIComponent(orderNumber)}` : ''
  }

  return {
    order,
    rootCauseEvent,
    impactEvent,
    rootCauseHref: `/events/${rootCauseEvent}/root-cause${eventQuery(rootCauseEvent)}`,
    impactHref: `/events/${impactEvent}/impact${eventQuery(impactEvent)}`,
  }
}

export interface PathContext {
  eventId: number | null
  order: string | null
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Parses the header's view context from the raw pathname. React Router matches
 * trailing slashes and paths case-insensitively, so the header must accept the
 * same forms and must not throw on a malformed percent escape.
 */
export function parsePathContext(pathname: string): PathContext {
  const path = pathname.replace(/\/+$/, '') || '/'
  const eventMatch = path.match(/^\/events\/(\d+)\/(?:root-cause|impact)$/i)
  const orderMatch = path.match(/^\/orders\/([^/]+)$/i)

  return {
    eventId: eventMatch ? Number(eventMatch[1]) : null,
    order: orderMatch ? decodeSegment(orderMatch[1]) : null,
  }
}

export interface StoredContextInput {
  currentEventId: number | null
  currentOrder: string | null
  contextOrder: string | null
  scenario?: DemoScenario
  orderPageOrder: string | null
  orderPageEventId: number | null
  previous: NavContext | null
}

/**
 * Returns the context that should be persisted for the current URL, or null
 * when the page carries no trustworthy order/event context (for example a bare
 * deep link to an event that does not belong to any known scenario).
 */
export function resolveStoredContext(input: StoredContextInput): NavContext | null {
  const {
    currentEventId,
    currentOrder,
    contextOrder,
    scenario,
    orderPageOrder,
    orderPageEventId,
    previous,
  } = input

  if (currentEventId !== null) {
    const order = contextOrder ?? scenario?.timelineOrder ?? null
    if (order === null) return null
    return {
      eventId: currentEventId,
      order,
      eventOrder: scenario?.timelineOrder ?? contextOrder ?? order,
    }
  }

  if (currentOrder !== null) {
    if (previous?.order === currentOrder && previous.eventId !== null) {
      return {
        eventId: previous.eventId,
        order: currentOrder,
        eventOrder: previous.eventOrder ?? currentOrder,
      }
    }
    if (orderPageOrder === currentOrder && orderPageEventId !== null) {
      return { eventId: orderPageEventId, order: currentOrder, eventOrder: currentOrder }
    }
    return { eventId: null, order: currentOrder, eventOrder: null }
  }

  return null
}
