import { useEffect, useState, type FormEvent } from 'react'
import { MAX_DATABASE_ID_LENGTH, MAX_ORDER_NUMBER_LENGTH } from '../config'
import { EVENT_SEARCH_PLACEHOLDER, ORDER_SEARCH_PLACEHOLDER } from '../demo'
import { parsePositiveInt } from '../lib/ids'
import { SearchIcon } from './icons'

interface SearchBarProps {
  initialValue: string
  onSearch: (value: string) => void
  kind: 'order' | 'event'
  buttonLabel: string
}

export function SearchBar({ initialValue, onSearch, kind, buttonLabel }: SearchBarProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const errorId = `${kind}-search-error`

  useEffect(() => {
    setValue(initialValue)
    setError(null)
  }, [initialValue])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = value.trim()

    if (!trimmed) {
      setError(
        kind === 'order' ? 'Enter an order number.' : 'Enter a positive whole-number event id.',
      )
      return
    }
    if (kind === 'event' && parsePositiveInt(trimmed) === null) {
      setError('Enter a positive whole-number event id.')
      return
    }

    setError(null)
    onSearch(trimmed)
  }

  return (
    <div className="search-bar-group">
      <form className="search-bar" onSubmit={submit} role="search" noValidate>
        <label className="sr-only" htmlFor={`${kind}-search`}>
          {kind === 'order' ? 'Order number' : 'Event id'}
        </label>
        <span className="search-bar__icon" aria-hidden="true">
          <SearchIcon size={17} />
        </span>
        <input
          id={`${kind}-search`}
          className="search-bar__input"
          type="text"
          inputMode={kind === 'event' ? 'numeric' : 'text'}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            if (error) setError(null)
          }}
          placeholder={kind === 'order' ? ORDER_SEARCH_PLACEHOLDER : EVENT_SEARCH_PLACEHOLDER}
          maxLength={kind === 'order' ? MAX_ORDER_NUMBER_LENGTH : MAX_DATABASE_ID_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button className="btn btn--primary search-bar__button" type="submit">
          {buttonLabel}
        </button>
      </form>
      {error ? (
        <p className="search-bar__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
