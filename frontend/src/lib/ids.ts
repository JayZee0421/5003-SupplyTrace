/** Parses a route/query id that must be a positive, JavaScript-safe integer. */
export function parsePositiveInt(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
