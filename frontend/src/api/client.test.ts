import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTimeline } from './client'

function timelineResponse(orderNumber: string): Response {
  return new Response(
    JSON.stringify({ order_number: orderNumber, count: 0, events: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('fetchTimeline', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one in-flight request between callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(timelineResponse('SO-SYN-000001'))
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([
      fetchTimeline('SO-SYN-000001'),
      fetchTimeline('SO-SYN-000001'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toEqual(second)
  })

  it('retries once after a transient network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(timelineResponse('SO-SYN-000007'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTimeline('SO-SYN-000007')).resolves.toMatchObject({
      order_number: 'SO-SYN-000007',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries once after a retryable 503 response', async () => {
    const unavailable = new Response(
      JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'database unavailable' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(timelineResponse('SO-SYN-000008'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTimeline('SO-SYN-000008')).resolves.toMatchObject({
      order_number: 'SO-SYN-000008',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 404 response', async () => {
    const missing = new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not found' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
    const fetchMock = vi.fn().mockResolvedValue(missing)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTimeline('SO-SYN-000009')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts only the caller that asked to abort', async () => {
    let resolveFetch!: (value: Response) => void
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const shared = fetchTimeline('SO-SYN-000002')
    const aborted = fetchTimeline('SO-SYN-000002', controller.signal)
    controller.abort()

    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })

    resolveFetch(timelineResponse('SO-SYN-000002'))
    await expect(shared).resolves.toMatchObject({ order_number: 'SO-SYN-000002' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
