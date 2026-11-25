import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AccessibilityIcon } from './icons'

type ColorVision = 'standard' | 'redGreen' | 'blueYellow' | 'monochrome'

interface DisplayPreferences {
  colorVision: ColorVision
  highContrast: boolean
  reduceMotion: boolean
}

const STORAGE_KEY = 'supplytrace:display'
const DEFAULTS: DisplayPreferences = {
  colorVision: 'standard',
  highContrast: false,
  reduceMotion: false,
}

const COLOR_VISION: Record<
  ColorVision,
  { label: string; hint: string; attribute: string | null }
> = {
  standard: {
    label: 'Standard',
    hint: 'Default green/amber/red status palette.',
    attribute: null,
  },
  redGreen: {
    label: 'Red-green safe',
    hint: 'Blue/orange/magenta; avoids red/green pairs.',
    attribute: 'red-green',
  },
  blueYellow: {
    label: 'Blue-yellow safe',
    hint: 'Green/vermillion/magenta; avoids blue/yellow pairs.',
    attribute: 'blue-yellow',
  },
  monochrome: {
    label: 'Monochrome',
    hint: 'Lightness steps plus marker shapes; icons and labels stay.',
    attribute: 'monochrome',
  },
}

function isColorVision(value: unknown): value is ColorVision {
  return value === 'standard' || value === 'redGreen' || value === 'blueYellow' || value === 'monochrome'
}

function readPreferences(): DisplayPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      colorVision?: unknown
      colorBlind?: unknown
      highContrast?: unknown
      reduceMotion?: unknown
    }
    const colorVision: ColorVision = isColorVision(parsed.colorVision)
      ? parsed.colorVision
      : parsed.colorBlind === true
        ? 'redGreen'
        : 'standard'
    return {
      colorVision,
      highContrast: parsed.highContrast === true,
      reduceMotion: parsed.reduceMotion === true,
    }
  } catch {
    return DEFAULTS
  }
}

function applyPreferences(preferences: DisplayPreferences) {
  const root = document.documentElement
  const mode = COLOR_VISION[preferences.colorVision].attribute
  if (mode) root.setAttribute('data-color-vision', mode)
  else root.removeAttribute('data-color-vision')

  const set = (name: string, enabled: boolean) => {
    if (enabled) root.setAttribute(name, 'true')
    else root.removeAttribute(name)
  }
  set('data-high-contrast', preferences.highContrast)
  set('data-reduce-motion', preferences.reduceMotion)
}

const STATUS_MARKERS: Array<{ tone: string; label: string }> = [
  { tone: 'good', label: 'Normal' },
  { tone: 'warning', label: 'Warning' },
  { tone: 'critical', label: 'Failed' },
  { tone: 'info', label: 'Completed' },
  { tone: 'muted', label: 'Cancelled' },
]

const CHECKBOX_OPTIONS: Array<{
  key: 'highContrast' | 'reduceMotion'
  label: string
  hint: string
}> = [
  {
    key: 'highContrast',
    label: 'High contrast',
    hint: 'Stronger text and panel borders.',
  },
  {
    key: 'reduceMotion',
    label: 'Reduce motion',
    hint: 'Turn off transitions and animations.',
  },
]

export function DisplayMenu() {
  const [preferences, setPreferences] = useState<DisplayPreferences>(readPreferences)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const lastPathname = useRef(location.pathname)

  useLayoutEffect(() => {
    applyPreferences(preferences)
  }, [preferences])

  useEffect(() => {
    if (lastPathname.current === location.pathname) return
    const focusWasInside = panelRef.current?.contains(document.activeElement) ?? false
    lastPathname.current = location.pathname
    setOpen(false)
    if (focusWasInside) buttonRef.current?.focus()
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.querySelector<HTMLElement>('select, input')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const persist = (next: DisplayPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }

  const update = (key: 'highContrast' | 'reduceMotion', value: boolean) => {
    setPreferences((previous) => {
      const next = { ...previous, [key]: value }
      persist(next)
      return next
    })
  }

  const updateColorVision = (value: ColorVision) => {
    setPreferences((previous) => {
      const next = { ...previous, colorVision: value }
      persist(next)
      return next
    })
  }

  const vision = COLOR_VISION[preferences.colorVision]

  return (
    <div className="display" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="display__button"
        aria-label="Display options"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="display-panel"
        title="Display options"
        onClick={() => setOpen((value) => !value)}
      >
        <AccessibilityIcon size={17} />
      </button>

      {open ? (
        <div
          className="display__panel"
          id="display-panel"
          role="dialog"
          aria-label="Display options"
          ref={panelRef}
        >
          <p className="display__title">Display</p>

          <div className="display__field">
            <label className="display__option-label" htmlFor="display-color-vision">
              Color vision
            </label>
            <select
              id="display-color-vision"
              className="display__select"
              value={preferences.colorVision}
              onChange={(event) => updateColorVision(event.target.value as ColorVision)}
            >
              {Object.entries(COLOR_VISION).map(([value, option]) => (
                <option value={value} key={value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="display__option-hint">{vision.hint}</span>
          </div>

          <div className="display__legend" aria-label="Status marker legend">
            <p className="display__legend-title">Status markers</p>
            <ul>
              {STATUS_MARKERS.map((marker) => (
                <li key={marker.tone}>
                  <span
                    className={`display__marker display__marker--${marker.tone}`}
                    aria-hidden="true"
                  />
                  {marker.label}
                </li>
              ))}
            </ul>
          </div>

          {CHECKBOX_OPTIONS.map((option) => (
            <label className="display__option" key={option.key}>
              <input
                type="checkbox"
                checked={preferences[option.key]}
                onChange={(event) => update(option.key, event.target.checked)}
              />
              <span className="display__option-label">{option.label}</span>
              <span className="display__option-hint">{option.hint}</span>
            </label>
          ))}

          <p className="display__note">
            Status is never color-only: every badge and dot keeps its icon and label.
          </p>
        </div>
      ) : null}
    </div>
  )
}
