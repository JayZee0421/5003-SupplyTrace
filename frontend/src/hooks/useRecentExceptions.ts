import { useEffect, useState } from 'react'
import { fetchTimeline } from '../api/client'
import { DEMO_ORDER_NUMBERS } from '../demo'
import { collectRecentExceptions, type RecentException } from '../lib/recent'
import type { Timeline } from '../types'

export interface RecentExceptionsState {
  exceptions: RecentException[]
  loading: boolean
  error: boolean
}

/**
 * The API has no global event-list endpoint, so "latest" is calculated across
 * the provided orders. The default is the demo watchlist; a production
 * deployment should pass the order list from a backend list/exception endpoint.
 */
export function useRecentExceptions(
  orderNumbers: string[] = DEMO_ORDER_NUMBERS,
): RecentExceptionsState {
  const orderKey = orderNumbers.join('|')
  const [state, setState] = useState<RecentExceptionsState>({
    exceptions: [],
    loading: true,
    error: false,
  })

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    Promise.allSettled(
      orderNumbers.map((orderNumber) => fetchTimeline(orderNumber, controller.signal)),
    )
      .then((results) => {
        if (!active) return
        const timelines = results
          .filter(
            (result): result is PromiseFulfilledResult<Timeline> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value)
        const exceptions = collectRecentExceptions(timelines)
        setState({ exceptions, loading: false, error: timelines.length === 0 })
      })
      .catch(() => {
        if (active) setState({ exceptions: [], loading: false, error: true })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [orderKey])

  return state
}
