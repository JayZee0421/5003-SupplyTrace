import type { EventStatus } from '../types'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DotIcon,
  SlashCircleIcon,
  XCircleIcon,
} from './icons'

const STATUS_META: Record<
  EventStatus,
  { label: string; tone: 'good' | 'warning' | 'critical' | 'info' | 'muted'; Icon: typeof DotIcon }
> = {
  NORMAL: { label: 'Normal', tone: 'good', Icon: DotIcon },
  WARNING: { label: 'Warning', tone: 'warning', Icon: AlertTriangleIcon },
  FAILED: { label: 'Failed', tone: 'critical', Icon: XCircleIcon },
  COMPLETED: { label: 'Completed', tone: 'info', Icon: CheckCircleIcon },
  CANCELLED: { label: 'Cancelled', tone: 'muted', Icon: SlashCircleIcon },
}

interface StatusBadgeProps {
  status: EventStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const meta = STATUS_META[status]
  const Icon = meta.Icon
  return (
    <span className={`badge badge--${meta.tone} badge--${size}`}>
      <Icon size={size === 'sm' ? 12 : 14} />
      <span>{meta.label}</span>
    </span>
  )
}

export function StatusDot({ status }: { status: EventStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`status-dot status-dot--${meta.tone}`} title={meta.label}>
      <span className="status-dot__mark" />
      <span className="status-dot__label">{meta.label}</span>
    </span>
  )
}

export function statusTone(status: EventStatus): string {
  return STATUS_META[status].tone
}
