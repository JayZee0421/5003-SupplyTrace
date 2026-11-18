import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface OrderPageState {
  order: string | null
  latestEventId: number | null
}

interface OrderPageContextValue extends OrderPageState {
  setOrderPage: (order: string, latestEventId: number | null) => void
  clearOrderPage: () => void
}

const OrderPageContext = createContext<OrderPageContextValue | null>(null)

/**
 * Lets the order timeline publish the event the navigation should anchor to.
 * Keeping this out of the URL avoids inventing a query parameter for a value
 * the page already fetched.
 */
export function OrderPageProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<OrderPageState>({ order: null, latestEventId: null })

  const setOrderPage = useCallback((order: string, latestEventId: number | null) => {
    setPage({ order, latestEventId })
  }, [])
  const clearOrderPage = useCallback(() => {
    setPage({ order: null, latestEventId: null })
  }, [])

  const value = useMemo(
    () => ({ ...page, setOrderPage, clearOrderPage }),
    [page, setOrderPage, clearOrderPage],
  )

  return <OrderPageContext.Provider value={value}>{children}</OrderPageContext.Provider>
}

export function useOrderPage() {
  const context = useContext(OrderPageContext)
  if (!context) throw new Error('useOrderPage must be used inside OrderPageProvider')
  return context
}
