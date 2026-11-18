import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Loading } from './components/Loading'
import { OrderPageProvider } from './context/OrderPageContext'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

const TimelinePage = lazy(() =>
  import('./pages/TimelinePage').then((module) => ({ default: module.TimelinePage })),
)
const RootCausePage = lazy(() =>
  import('./pages/RootCausePage').then((module) => ({ default: module.RootCausePage })),
)
const ImpactPage = lazy(() =>
  import('./pages/ImpactPage').then((module) => ({ default: module.ImpactPage })),
)
const DurationsPage = lazy(() =>
  import('./pages/DurationsPage').then((module) => ({ default: module.DurationsPage })),
)

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [pathname])

  return null
}

function page(element: ReactNode, label: string) {
  return <Suspense fallback={<Loading label={label} />}>{element}</Suspense>
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <OrderPageProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route
              path="orders/:orderNumber"
              element={page(<TimelinePage />, 'Loading order timeline')}
            />
            <Route
              path="events/:eventId/root-cause"
              element={page(<RootCausePage />, 'Loading root-cause view')}
            />
            <Route
              path="events/:eventId/impact"
              element={page(<ImpactPage />, 'Loading impact view')}
            />
            <Route
              path="durations"
              element={page(<DurationsPage />, 'Loading duration view')}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </OrderPageProvider>
    </BrowserRouter>
  )
}
