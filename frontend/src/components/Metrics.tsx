import type { ReactNode } from 'react'

export interface Metric {
  label: string
  value: ReactNode
  hint?: ReactNode
}

export function Metrics({ items }: { items: Metric[] }) {
  return (
    <dl className="metrics">
      {items.map((item) => (
        <div className="metrics__item" key={item.label}>
          <dt className="metrics__label">{item.label}</dt>
          <dd className="metrics__value">{item.value}</dd>
          {item.hint ? <dd className="metrics__hint">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}
