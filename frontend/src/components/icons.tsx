interface IconProps {
  size?: number
  className?: string
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function LogoIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#171a2b" stroke="#2e3550" />
      <path
        d="M9 10.5h4.5V16H22"
        fill="none"
        stroke="#8b95f2"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.6" cy="10.5" r="2.3" fill="#8b95f2" />
      <circle cx="14.2" cy="16" r="2.3" fill="#8b95f2" />
      <circle cx="22.2" cy="16" r="2.3" fill="#8b95f2" />
    </svg>
  )
}

export function SearchIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function TimelineIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M6 8v8" />
      <path d="M11 6h9M11 18h9" />
    </svg>
  )
}

export function RouteIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8.2 18H14a2 2 0 0 0 2-2V8.2" />
    </svg>
  )
}

export function NetworkIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="19" r="2.2" />
      <circle cx="19" cy="19" r="2.2" />
      <path d="M12 7.2v4.3M10.5 12.6 6.3 16.9M13.5 12.6l4.2 4.3" />
    </svg>
  )
}

export function ClockIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function AlertTriangleIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="M12 3.6 21 20H3L12 3.6Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function XCircleIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  )
}

export function CheckCircleIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.4 12.2 2.4 2.4 4.8-5" />
    </svg>
  )
}

export function DotIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="8.2" />
    </svg>
  )
}

export function SlashCircleIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m7 17 10-10" />
    </svg>
  )
}

export function BoxIcon({ size = 28, className }: IconProps) {
  return (
    <svg {...svgProps(size)} className={className}>
      <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
      <path d="m4 7.2 8 4.2 8-4.2M12 11.4V21" />
    </svg>
  )
}

