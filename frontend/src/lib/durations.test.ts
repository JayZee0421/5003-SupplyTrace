import { describe, expect, it } from 'vitest'
import type { Stage } from '../types'
import { isoToLocalInput, parseLocalInput, topStage } from './durations'

function stage(
  stageOrder: number,
  averageHours: number | null,
  p90Hours: number | null,
  sampleLines = 1,
): Stage {
  return {
    stage_order: stageOrder,
    stage: `Stage ${stageOrder}`,
    sample_lines: sampleLines,
    average_hours: averageHours,
    p90_hours: p90Hours,
  }
}

describe('parseLocalInput', () => {
  it('parses a local date-time with a space or a T separator', () => {
    const spaced = parseLocalInput('2026-01-02 03:04')
    expect(spaced?.getFullYear()).toBe(2026)
    expect(spaced?.getMonth()).toBe(0)
    expect(spaced?.getDate()).toBe(2)
    expect(spaced?.getHours()).toBe(3)
    expect(spaced?.getMinutes()).toBe(4)

    expect(parseLocalInput('2026-01-02T03:04')?.getHours()).toBe(3)
    expect(parseLocalInput(' 2026-01-02 03:04 ')?.getMinutes()).toBe(4)
  })

  it('rejects invalid formats and impossible dates', () => {
    for (const value of ['2026-02-30 10:00', '2026-1-2 3:4', '01/02/2026 10:00', 'tomorrow', '']) {
      expect(parseLocalInput(value)).toBeNull()
    }
  })
})

describe('isoToLocalInput', () => {
  it('returns a YYYY-MM-DD HH:mm value for a valid ISO timestamp', () => {
    expect(isoToLocalInput('2026-01-01T00:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('returns an empty string for missing or invalid timestamps', () => {
    expect(isoToLocalInput('')).toBe('')
    expect(isoToLocalInput('not-a-date')).toBe('')
  })
})

describe('topStage', () => {
  const stages = [stage(1, 2, 5), stage(2, 8, 3), stage(3, null, null, 0)]

  it('finds the stage with the largest average', () => {
    expect(topStage(stages, 'average_hours')?.stage_order).toBe(2)
  })

  it('finds the stage with the largest P90, independent of the average', () => {
    expect(topStage(stages, 'p90_hours')?.stage_order).toBe(1)
  })

  it('ignores null statistics and returns null when no stage has data', () => {
    expect(topStage([stage(1, null, null, 0)], 'average_hours')).toBeNull()
    expect(topStage([], 'p90_hours')).toBeNull()
  })
})
