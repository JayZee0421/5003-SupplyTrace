import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AccessibilityIcon } from './icons'

interface DisplayPreferences {
  colorBlind: boolean
  highContrast: boolean
  reduceMotion: boolean
}

const STORAGE_KEY = 'supplytrace:display'
const DEFAULTS: DisplayPreferences = {
  colorBlind: false,
  highContrast: false,
  reduceMotion: false,
}

function readPreferences(): DisplayPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<DisplayPreferences>
    return {
      colorBlind: parsed.colorBlind === true,
      highContrast: parsed.highContrast === true,
      reduceMotion: parsed.reduceMotion === true,
    }
  } catch {
    return DEFAULTS
  }
}

function applyPreferences(preferences: DisplayPreferences) {
  const root = document.documentElement
  const set = (name: string, enabled: boolean) => {
    if (enabled) root.setAttribute(name, 'true')
    else root.removeAttribute(name)
  }
  set('data-color-blind', preferences.colorBlind)
  set('data-high-contrast', preferences.highContrast)
  set('data-reduce-motion', preferences.reduceMotion)
}

const OPTIONS: Array<{
  key: keyof DisplayPreferences
  label: string
  hint: string
}> = [
  {
    key: 'colorBlind',
    label: 'Color-blind friendly',
    hint: 'Blue/orange status palette; icons and text stay.',
  },
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
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    applyPreferences(preferences)
  }, [preferences])

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
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const update = (key: keyof DisplayPreferences, value: boolean) => {
    setPreferences((previous) => {
      const next = { ...previous, [key]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage can be unavailable in private browsing.
      }
      return next
    })
  }

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
          {OPTIONS.map((option) => (
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
