import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Stage } from '../types'
import { formatHours, formatNumber } from '../lib/format'
import { SERIES } from '../lib/theme'

interface TooltipItem {
  value?: number | null
  name?: string
  color?: string
  dataKey?: string | number
  payload?: { samples?: number; name?: string }
}

interface DurationTooltipProps {
  active?: boolean
  label?: string | number
  payload?: TooltipItem[]
}

function wrapStageLabel(value: string): string[] {
  if (value.length <= 27) return [value]
  const words = value.split(' ')
  let first = ''
  let index = 0

  while (index < words.length) {
    const candidate = first ? `${first} ${words[index]}` : words[index]
    if (first && candidate.length > 26) break
    first = candidate
    index += 1
  }

  const rest = words.slice(index).join(' ')
  return rest ? [first, rest] : [first]
}

interface StageTickProps {
  x?: number
  y?: number
  payload?: { value?: string | number }
}

function StageTick({ x = 0, y = 0, payload }: StageTickProps) {
  const lines = wrapStageLabel(String(payload?.value ?? ''))

  return (
    <text x={x} y={y} textAnchor="end" fill="#b8bdc6" fontSize={11.5}>
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? (lines.length > 1 ? -1 : 4) : 13}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function DurationTooltip({ active, label, payload }: DurationTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const samples = payload[0]?.payload?.samples

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__title">{label}</p>
      <div className="chart-tooltip__rows">
        {payload.map((item) => (
          <div className="chart-tooltip__row" key={String(item.dataKey)}>
            <span className="chart-tooltip__key" style={{ background: item.color }} />
            <span className="chart-tooltip__value">{formatHours(item.value ?? null)}</span>
            <span className="chart-tooltip__name">{item.name}</span>
          </div>
        ))}
      </div>
      {samples !== undefined ? (
        <p className="chart-tooltip__foot">{formatNumber(samples)} order lines sampled</p>
      ) : null}
    </div>
  )
}

export function DurationChart({ stages }: { stages: Stage[] }) {
  const data = stages.map((stage) => ({
    name: stage.stage,
    average: stage.average_hours,
    p90: stage.p90_hours,
    samples: stage.sample_lines,
  }))
  const height = Math.max(360, stages.length * 58 + 32)

  return (
    <div className="chart-frame">
      <div className="chart-legend" aria-hidden="true">
        <span className="chart-legend__item">
          <span className="chart-legend__swatch" style={{ background: SERIES.average }} />
          Average hours
        </span>
        <span className="chart-legend__item">
          <span className="chart-legend__swatch" style={{ background: SERIES.p90 }} />
          P90 hours
        </span>
      </div>
      <div className="chart-plot">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 28, bottom: 8, left: 4 }}
            barGap={2}
            barCategoryGap="26%"
          >
            <CartesianGrid horizontal={false} stroke="#232527" strokeWidth={1} />
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tick={{ fill: '#858b94', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#34373b' }}
              tickFormatter={(value: number) => `${value} h`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={232}
              tick={<StageTick />}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.035)' }}
              content={<DurationTooltip />}
            />
            <Bar
              dataKey="average"
              name="Average"
              fill={SERIES.average}
              barSize={10}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="p90"
              name="P90"
              fill={SERIES.p90}
              barSize={10}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
