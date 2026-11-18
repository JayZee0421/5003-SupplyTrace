import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeError, type ApiError } from '../api/client'

interface AsyncState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

/**
 * Runs an abortable request whenever `key` changes. Previous data is kept
 * during a refetch so the page frame does not collapse into a skeleton.
 */
export function useApi<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  })
  const [nonce, setNonce] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const previousKey = useRef(key)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const isNewKey = previousKey.current !== key
    previousKey.current = key

    // A new route or filter starts from a clean slate; a manual reload keeps
    // the current frame visible while the next snapshot arrives.
    setState((previous) => ({
      data: isNewKey ? null : previous.data,
      error: null,
      loading: true,
    }))

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        const normalized = normalizeError(error)
        if (!active || normalized.code === 'ABORTED') return
        setState((previous) => ({ ...previous, error: normalized, loading: false }))
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [key, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { ...state, reload }
}
