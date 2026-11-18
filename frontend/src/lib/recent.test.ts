import { describe, expect, it } from 'vitest'
import timeline1 from '../mocks/timeline.json'
import timeline2 from '../mocks/timeline_so2.json'
import type { Timeline } from '../types'
import { collectRecentExceptions } from './recent'

const first = timeline1 as unknown as Timeline
const second = timeline2 as unknown as Timeline

describe('collectRecentExceptions', () => {
  it('flattens exceptions across timelines, newest first', () => {
    const rows = collectRecentExceptions([first, second])
    expect(rows.length).toBeGreaterThan(2)
    expect(rows[0].event.event_id).toBe(10)
    expect(rows[0].orderNumber).toBe('SO-SYN-000001')
    expect(rows[0].customer).toBe('Synthetic customer A')
    expect(rows[0].commitment).toBe('2026-01-03')
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index - 1].event.event_time >= rows[index].event.event_time).toBe(true)
    }
  })

  it('honours the result limit', () => {
    expect(collectRecentExceptions([first, second], 1)).toHaveLength(1)
    expect(collectRecentExceptions([first, second], 2)).toHaveLength(2)
  })

  it('returns an empty list when no exceptions are present', () => {
    expect(collectRecentExceptions([])).toEqual([])
  })
})
