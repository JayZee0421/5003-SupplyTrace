const utcFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
})

export function formatUtc(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const parts = Object.fromEntries(
    utcFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} UTC`
}

export function formatUtcShort(iso: string): string {
  return formatUtc(iso).replace(' UTC', '').slice(5)
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(2)} h`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en').format(value)
}

export function formatCommitment(value: string | null): string {
  return value ?? 'No active commitment'
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}
