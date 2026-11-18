import { describe, expect, it } from 'vitest'
import timelineMock from '../mocks/timeline.json'
import type { EventRecord, Timeline } from '../types'
import { sortEventsNewestFirst } from './events'

const events = (timelineMock as unknown as Timeline).events

describe('sortEventsNewestFirst', () => {
  it('puts the newest event first without mutating the input', () => {
    const originalIds = events.map((event) => event.event_id)
    const sorted = sortEventsNewestFirst(events)

    expect(sorted[0].event_id).toBe(10)
    expect(sorted[sorted.length - 1].event_id).toBe(1)
    expect(events.map((event) => event.event_id)).toEqual(originalIds)
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index - 1].event_time >= sorted[index].event_time).toBe(true)
    }
  })

  it('breaks timestamp ties by higher event id', () => {
    const tied: EventRecord[] = [
      { ...events[0], event_id: 100, event_time: '2026-01-01T00:00:00Z' },
      { ...events[0], event_id: 101, event_time: '2026-01-01T00:00:00Z' },
    ]

    expect(sortEventsNewestFirst(tied).map((event) => event.event_id)).toEqual([101, 100])
  })
})
