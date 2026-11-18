import type { ReactNode } from 'react'
import { BoxIcon } from './icons'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  icon?: ReactNode
}

export function EmptyState({ title, children, icon }: EmptyStateProps) {
  return (
    <div className="state-panel state-panel--empty">
      <span className="state-panel__icon" aria-hidden="true">
        {icon ?? <BoxIcon size={30} />}
      </span>
      <p className="state-panel__title">{title}</p>
      {children ? <div className="state-panel__body">{children}</div> : null}
    </div>
  )
}
