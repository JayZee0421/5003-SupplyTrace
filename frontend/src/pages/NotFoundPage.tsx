import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'

export function NotFoundPage() {
  return (
    <div>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title">This view does not exist</h1>
          <p className="page-subtitle">Check the link or start again from the overview.</p>
        </div>
      </header>
      <EmptyState title="Unknown route">
        <p>The address you followed is not part of this application.</p>
        <p className="state-panel__actions">
          <Link className="btn btn--primary" to="/">
            Back to overview
          </Link>
        </p>
      </EmptyState>
    </div>
  )
}
