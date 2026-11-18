import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangleIcon } from './icons'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors inside a route so the header and navigation keep
 * working. The URL, filters and selected ids stay in the address bar.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)

    // A stale lazy-loaded chunk is common after a dev HMR update or a deploy;
    // reload once so the navigation picks up the current module graph.
    const chunkFailed =
      /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i.test(
        error.message,
      )
    if (!chunkFailed) return
    try {
      if (sessionStorage.getItem('supplytrace:chunk-reload') !== '1') {
        sessionStorage.setItem('supplytrace:chunk-reload', '1')
        window.location.reload()
      }
    } catch {
      // Storage can be unavailable in private browsing; fall back to the button.
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="state-panel state-panel--error" role="alert">
        <span className="state-panel__icon state-panel__icon--error" aria-hidden="true">
          <AlertTriangleIcon size={28} />
        </span>
        <p className="state-panel__title">This view stopped unexpectedly</p>
        <p className="state-panel__body">
          A rendering error occurred. Reload the page or return to the overview; the current URL
          and filters are kept.
        </p>
        <div className="state-panel__actions">
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a className="btn" href="/">
            Back to overview
          </a>
        </div>
      </div>
    )
  }
}
