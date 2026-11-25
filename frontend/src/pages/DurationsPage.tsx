import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchDurations, MOCK_MODE } from '../api/client'
import { useApi } from '../hooks/useApi'
import { MAX_DATABASE_ID_LENGTH } from '../config'
import { isoToLocalInput, parseLocalInput, topStage } from '../lib/durations'
import { formatHours, formatNumber } from '../lib/format'
import { parsePositiveInt } from '../lib/ids'
import type { DurationFilters } from '../types'
import { DurationChart } from '../components/DurationChart'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { Metrics } from '../components/Metrics'

export function DurationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramsKey = searchParams.toString()

  const filters: DurationFilters = {
    orderNumber: searchParams.get('order_number') ?? '',
    orderLineId: searchParams.get('order_line_id') ?? '',
    startTime: searchParams.get('start_time') ?? '',
    endTime: searchParams.get('end_time') ?? '',
  }

  const state = useApi(`durations:${paramsKey}`, (signal) => fetchDurations(filters, signal))

  const [orderNumber, setOrderNumber] = useState(filters.orderNumber)
  const [orderLineId, setOrderLineId] = useState(filters.orderLineId)
  const [startInput, setStartInput] = useState(isoToLocalInput(filters.startTime))
  const [endInput, setEndInput] = useState(isoToLocalInput(filters.endTime))
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setOrderNumber(filters.orderNumber)
    setOrderLineId(filters.orderLineId)
    setStartInput(isoToLocalInput(filters.startTime))
    setEndInput(isoToLocalInput(filters.endTime))
    setFormError(null)
    // Re-sync the form whenever the URL (the source of truth) changes.
  }, [paramsKey])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = new URLSearchParams()
    const order = orderNumber.trim()
    const line = orderLineId.trim()

    if (line && parsePositiveInt(line) === null) {
      setFormError('Order line id must be a positive integer.')
      return
    }

    const start = startInput.trim() ? parseLocalInput(startInput) : null
    const end = endInput.trim() ? parseLocalInput(endInput) : null

    if (startInput.trim() && start === null) {
      setFormError('Start time must use YYYY-MM-DD HH:mm.')
      return
    }
    if (endInput.trim() && end === null) {
      setFormError('End time must use YYYY-MM-DD HH:mm.')
      return
    }
    if (start && end && start >= end) {
      setFormError('Start time must be earlier than end time.')
      return
    }

    if (order) next.set('order_number', order)
    if (line) next.set('order_line_id', line)
    if (start) next.set('start_time', start.toISOString())
    if (end) next.set('end_time', end.toISOString())

    setFormError(null)
    setSearchParams(next)
  }

  const reset = () => {
    setOrderNumber('')
    setOrderLineId('')
    setStartInput('')
    setEndInput('')
    setFormError(null)
    setSearchParams(new URLSearchParams())
  }

  const data = state.data
  const activeStages = data ? data.stages.filter((stage) => stage.sample_lines > 0) : []
  const highestP90 = data ? topStage(data.stages, 'p90_hours') : null
  const largestSample = data
    ? data.stages.reduce((max, stage) => Math.max(max, stage.sample_lines), 0)
    : 0

  return (
    <div>
      <header className="page-head">
        <div className="page-head__text">
          <h1 className="page-title">Fulfilment stage durations</h1>
          <p className="page-subtitle">
            Average and P90 hours for every fulfilment stage, filterable by order, order line and
            time window. All event times are UTC.
          </p>
        </div>
      </header>

      <section className="panel filters-panel" aria-label="Duration filters">
        <form className="filter-row" onSubmit={submit} noValidate>
          <label className="field">
            <span>Order number</span>
            <input
              type="text"
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="Any order"
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>Order line id</span>
            <input
              type="text"
              inputMode="numeric"
              value={orderLineId}
              onChange={(event) => setOrderLineId(event.target.value)}
              placeholder="Any line"
              maxLength={MAX_DATABASE_ID_LENGTH}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Start (local)</span>
            <input
              type="text"
              value={startInput}
              onChange={(event) => setStartInput(event.target.value)}
              placeholder="YYYY-MM-DD HH:mm"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>End (local)</span>
            <input
              type="text"
              value={endInput}
              onChange={(event) => setEndInput(event.target.value)}
              placeholder="YYYY-MM-DD HH:mm"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="filter-row__actions">
            <button className="btn btn--primary" type="submit">
              Apply filters
            </button>
            <button className="btn" type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </form>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <p className="field-hint">
          Times use YYYY-MM-DD HH:mm in your local timezone and are sent to the API as UTC.
          Filters are stored in the URL, so this view can be deep-linked.
        </p>
        {MOCK_MODE ? (
          <p className="field-hint">
            Mock mode only serves the unfiltered global fixture; filter requests return an
            explanation instead of data.
          </p>
        ) : null}
      </section>

      {filters.orderNumber ? (
        <div className="page-actions">
          <Link
            className="btn btn--ghost btn--sm"
            to={`/orders/${encodeURIComponent(filters.orderNumber)}`}
          >
            Open order timeline for {filters.orderNumber}
          </Link>
        </div>
      ) : null}

      {state.loading && !data ? <Loading label="Loading stage durations" /> : null}

      {state.error ? (
        <ErrorState error={state.error} onRetry={state.reload} title="Duration view unavailable">
          <Link className="btn" to="/">
            Back to overview
          </Link>
        </ErrorState>
      ) : null}

      {data && !state.error ? (
        <>
          <Metrics
            items={[
              {
                label: 'Stages',
                value: `${activeStages.length} / ${data.stages.length}`,
                hint: 'With samples',
              },
              {
                label: 'Lines sampled',
                value: formatNumber(largestSample),
                hint: 'Largest stage sample',
              },
              {
                label: 'Slowest P90',
                value: formatHours(highestP90?.p90_hours ?? null),
                hint: highestP90
                  ? `${highestP90.stage} · average ${formatHours(
                      highestP90.average_hours,
                    )}`
                  : 'No samples',
              },
            ]}
          />

          <section className="panel">
            <header className="panel__head">
              <div>
                <h2>Average and P90 hours per stage</h2>
                <p>Hover a bar for the stage value and sample count.</p>
              </div>
            </header>

            {activeStages.length === 0 ? (
              <EmptyState title="No duration samples for these filters">
                <p>
                  Every stage returned zero sampled lines. Widen the time window or clear the order
                  and line filters.
                </p>
              </EmptyState>
            ) : (
              <>
                <DurationChart stages={data.stages} />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="num">#</th>
                        <th>Stage</th>
                        <th className="num">Sample lines</th>
                        <th className="num">Average</th>
                        <th className="num">P90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stages.map((stage) => (
                        <tr
                          key={stage.stage_order}
                          className={stage.sample_lines === 0 ? 'data-table__row--empty' : undefined}
                        >
                          <td className="num">{stage.stage_order}</td>
                          <td>{stage.stage}</td>
                          <td className="num">{formatNumber(stage.sample_lines)}</td>
                          <td className="num">{formatHours(stage.average_hours)}</td>
                          <td className="num">{formatHours(stage.p90_hours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="panel__note">
                  Only stages with both endpoints and a non-negative duration are sampled. Quality
                  check uses the first NORMAL pass. P90 uses{' '}
                  <span className="mono">percentile_cont(0.9)</span> with linear interpolation. A
                  time window keeps each order line's full lifecycle.
                </p>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
