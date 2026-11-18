import type { Stage } from '../types'

/** Converts an ISO timestamp from the URL into an English, locale-free input value. */
export function isoToLocalInput(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Parses `YYYY-MM-DD HH:mm` (or with a T) as a local time, or returns null. */
export function parseLocalInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  return roundTrips ? date : null
}

/** Stage with the largest non-null value for the given statistic. */
export function topStage(
  stages: Stage[],
  key: 'average_hours' | 'p90_hours',
): Stage | null {
  return stages.reduce<Stage | null>((best, stage) => {
    const value = stage[key]
    if (value === null) return best
    const bestValue = best?.[key] ?? null
    return bestValue === null || value > bestValue ? stage : best
  }, null)
}
