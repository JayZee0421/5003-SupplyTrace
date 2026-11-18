import type { EventRecord } from '../types'

/** Newest event first; equal timestamps fall back to the higher event id. */
export function sortEventsNewestFirst(events: EventRecord[]): EventRecord[] {
  return [...events].sort(
    (left, right) =>
      right.event_time.localeCompare(left.event_time) ||
      right.event_id - left.event_id,
  )
}
