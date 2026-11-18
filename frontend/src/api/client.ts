import type {
  Durations,
  DurationFilters,
  Health,
  Impact,
  RootCause,
  Timeline,
} from '../types'
import { API_RETRY_DELAY_MS, MAX_GRAPH_DEPTH } from '../config'
import { DEMO_SCENARIOS } from '../demo'
import timelineMock from '../mocks/timeline.json'
import timelineSo2Mock from '../mocks/timeline_so2.json'
import rootCauseMock from '../mocks/root_cause.json'
import rootCause3Mock from '../mocks/root_cause_3.json'
import impactMock from '../mocks/impact.json'
import stageDurationsMock from '../mocks/stage_durations.json'
import notFoundMock from '../mocks/not_found.json'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const demoScenario = DEMO_SCENARIOS[0]
const secondDemoOrder = demoScenario.impactedOrders[1]

export const MOCK_MODE = import.meta.env.VITE_USE_MOCK === 'true'

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status = 0, code = 'NETWORK_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiError('Request cancelled', 0, 'ABORTED')
  }
  return new ApiError(error instanceof Error ? error.message : 'Unexpected error', 0, 'UNKNOWN')
}

function mockResponse(path: string): unknown {
  const pathname = path.split('?')[0]

  if (pathname === `/api/orders/${demoScenario.timelineOrder}/timeline`) return timelineMock
  if (secondDemoOrder && pathname === `/api/orders/${secondDemoOrder}/timeline`) {
    return timelineSo2Mock
  }
  if (pathname === `/api/events/${demoScenario.traceFromEventId}/root-cause`) return rootCauseMock
  if (pathname === `/api/events/${demoScenario.rootEventId}/root-cause`) return rootCause3Mock
  if (pathname === `/api/events/${demoScenario.rootEventId}/impact`) return impactMock
  if (pathname === '/api/analytics/stage-durations') {
    const query = path.split('?')[1] ?? ''
    if (query) {
      throw new ApiError(
        'Mock mode only includes the unfiltered stage-durations fixture. Start the API to use filters.',
        501,
        'MOCK_UNSUPPORTED',
      )
    }
    return stageDurationsMock
  }
  if (pathname === '/health') return { status: 'ok' }

  const message =
    (notFoundMock as { error?: { message?: string } }).error?.message ?? 'Not found in mock fixtures'
  throw new ApiError(
    `${message} Mock mode only bundles the ${demoScenario.name.toLowerCase()} path.`,
    404,
    'NOT_FOUND',
  )
}

const RETRYABLE_STATUS = new Set([502, 503, 504])

function waitForRetry(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, API_RETRY_DELAY_MS)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function request<T>(path: string, signal?: AbortSignal, attempt = 0): Promise<T> {
  if (MOCK_MODE) return mockResponse(path) as T

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (attempt === 0 && !signal?.aborted) {
      await waitForRetry(signal)
      return request<T>(path, signal, 1)
    }
    throw new ApiError(
      'Cannot reach the SupplyTrace API. Check that the backend is running and reachable.',
      0,
      'NETWORK_ERROR',
    )
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    if (attempt === 0 && RETRYABLE_STATUS.has(response.status) && !signal?.aborted) {
      await waitForRetry(signal)
      return request<T>(path, signal, 1)
    }
    const envelope = body as { error?: { code?: string; message?: string } } | null
    throw new ApiError(
      envelope?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      envelope?.error?.code ?? 'HTTP_ERROR',
    )
  }

  return body as T
}

const timelineInFlight = new Map<string, Promise<Timeline>>()

/** Abort only this caller; a request shared with other callers keeps running. */
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

export function fetchTimeline(orderNumber: string, signal?: AbortSignal): Promise<Timeline> {
  let shared = timelineInFlight.get(orderNumber)
  if (!shared) {
    const promise = request<Timeline>(`/api/orders/${encodeURIComponent(orderNumber)}/timeline`)
    shared = promise
    timelineInFlight.set(orderNumber, promise)
    // The home page asks for the same seeded order from the preview, readiness
    // check and latest-exceptions panel; share that request but keep each
    // caller's abort signal local.
    promise.then(
      () => {
        if (timelineInFlight.get(orderNumber) === promise) timelineInFlight.delete(orderNumber)
      },
      () => {
        if (timelineInFlight.get(orderNumber) === promise) timelineInFlight.delete(orderNumber)
      },
    )
  }
  return abortable(shared, signal)
}

export function fetchRootCause(
  eventId: number,
  signal?: AbortSignal,
  maxDepth = MAX_GRAPH_DEPTH,
): Promise<RootCause> {
  return request<RootCause>(
    `/api/events/${eventId}/root-cause?max_depth=${maxDepth}`,
    signal,
  )
}

export function fetchImpact(
  eventId: number,
  signal?: AbortSignal,
  maxDepth = MAX_GRAPH_DEPTH,
): Promise<Impact> {
  return request<Impact>(`/api/events/${eventId}/impact?max_depth=${maxDepth}`, signal)
}

export function fetchDurations(
  filters: DurationFilters,
  signal?: AbortSignal,
): Promise<Durations> {
  const search = new URLSearchParams()
  if (filters.orderNumber.trim()) search.set('order_number', filters.orderNumber.trim())
  if (filters.orderLineId.trim()) search.set('order_line_id', filters.orderLineId.trim())
  if (filters.startTime) search.set('start_time', filters.startTime)
  if (filters.endTime) search.set('end_time', filters.endTime)
  const query = search.toString()
  return request<Durations>(`/api/analytics/stage-durations${query ? `?${query}` : ''}`, signal)
}

export function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return request<Health>('/health', signal)
}
