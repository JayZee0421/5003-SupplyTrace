import type { EventRecord, Timeline } from '../types'

export interface RecentException {
  event: EventRecord
  orderNumber: string
  customer: string | null
  commitment: string | null
}

/** Flattens exception events from any number of order timelines, newest first. */
export function collectRecentExceptions(
  timelines: Timeline[],
  limit = 6,
): RecentException[] {
  return timelines
    .flatMap((timeline) => {
      const customer =
        timeline.events.find((event) => event.entity_type === 'CUSTOMER')?.subject_entity ??
        null
      const commitment =
        timeline.events.find((event) => event.current_commitment !== null)?.current_commitment ??
        null
      return timeline.events
        .filter((event) => event.is_exception)
        .map((event) => ({
          event,
          orderNumber: timeline.order_number,
          customer,
          commitment,
        }))
    })
    .sort(
      (left, right) =>
        right.event.event_time.localeCompare(left.event.event_time) ||
        right.event.event_id - left.event.event_id,
    )
    .slice(0, limit)
}
