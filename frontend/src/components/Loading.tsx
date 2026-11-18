export function Loading({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="state-panel__title">{label}</p>
      <p className="state-panel__body">Fetching the latest snapshot from the SupplyTrace API.</p>
    </div>
  )
}
