import type { ReactNode } from 'react'
import type { ApiError } from '../api/client'
import { AlertTriangleIcon } from './icons'

interface ErrorStateProps {
  error: ApiError
  title?: string
  onRetry?: () => void
  children?: ReactNode
}

function explain(error: ApiError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'The frontend cannot reach the API. Start the FastAPI backend and check the API base URL, or enable mock mode in .env.local.'
    case 'NOT_FOUND':
      return 'The requested order, order line or event does not exist in this database snapshot.'
    case 'VALIDATION_ERROR':
      return 'The request parameters were rejected. Check the order number, event id and time range.'
    case 'DATABASE_UNAVAILABLE':
      return 'The API is running but its database is unavailable. Check the PostgreSQL connection.'
    case 'QUERY_TIMEOUT':
      return 'The query exceeded the server time limit. Try a narrower time range.'
    case 'MOCK_UNSUPPORTED':
      return 'Mock mode only includes the global stage-duration fixture. Start the FastAPI backend to apply order, line or time filters.'
    default:
      return 'The API returned an unexpected response.'
  }
}

export function ErrorState({ error, title, onRetry, children }: ErrorStateProps) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <span className="state-panel__icon state-panel__icon--error" aria-hidden="true">
        <AlertTriangleIcon size={28} />
      </span>
      <p className="state-panel__title">{title ?? 'Could not load this view'}</p>
      <p className="state-panel__body">{explain(error)}</p>
      <p className="state-panel__detail">
        <span className="code-pill">{error.code}</span>
        {error.status ? <span className="code-pill">HTTP {error.status}</span> : null}
        <span className="state-panel__message">{error.message}</span>
      </p>
      <div className="state-panel__actions">
        {onRetry ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        {children}
      </div>
    </div>
  )
}
