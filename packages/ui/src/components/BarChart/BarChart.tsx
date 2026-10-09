'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createLogger } from '@genui-github/core'
import { bandCenter, formatChartValue, formatTick, niceScale, UNIT_WORDS, yPercent } from '../../charts/scale'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { validateNumbers } from '../../validate/numbers'
import { barFacts } from './facts'
import { BAR_EMPTY, BY_WORDS, MAX_BARS, type BarChartProps } from './schema'
import styles from './BarChart.module.css'

const log = createLogger('ui:barchart')

// Read from tokens.css at mount; it only steers which value labels show, never paint.
const BAND_COUNT_FALLBACK = 32

/** The bars as drawn: never more than twelve, whatever the system sent. */
export const barsOf = (props: BarChartProps) => props.bars.slice(0, MAX_BARS)

/** Zero-based, round ticks, from the largest bar. */
export const barScale = (props: BarChartProps) => niceScale(Math.max(0, ...barsOf(props).map(b => b.value)))

/** A bar's height as a percent of the plot. */
export const barHeight = (value: number, max: number) => 100 - yPercent(Math.max(0, value), max)


/** The aria-label: the model's finding when its numbers check out, else the system's own summary. */
export function chartLabel(props: BarChartProps): string {
  const bars = barsOf(props)
  const check = validateNumbers(props.finding, barFacts(bars.map(b => b.value)))
  if (check.ok) return props.finding
  log.warn('barchart finding did not match its bars', { mismatches: check.mismatches.map(m => m.raw) })
  const top = bars.reduce<(typeof bars)[number] | undefined>((a, b) => (a === undefined || b.value > a.value ? b : a), undefined)
  const unit = UNIT_WORDS[props.unit]
  const plural = BY_WORDS[props.by].plural
  return `${props.title} across ${bars.length} ${plural}${top ? `, the largest ${top.label} at ${formatChartValue(top.value, props.unit)}${unit ? ` ${unit}` : ''}` : ''}.`
}

export function BarChart({ props, state, error, warming, onRetry }: PieceRenderProps<BarChartProps>) {
  const { title, meta, unit, by } = props
  const bars = barsOf(props)
  const n = bars.length
  const plotRef = useRef<HTMLDivElement>(null)
  const [bandCount, setBandCount] = useState({ plot: 560, min: BAND_COUNT_FALLBACK })
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const read = () => {
      // Until there is a layout (or under a test DOM), keep the defaults rather than a zero-width plot.
      if (!el.clientWidth) return
      const min = parseFloat(getComputedStyle(el).getPropertyValue('--band-count'))
      setBandCount({ plot: el.clientWidth, min: Number.isFinite(min) ? min : BAND_COUNT_FALLBACK })
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [state])

  const frame = (body: React.ReactNode) => (
    <CardFrame
      as="figure"
      title={state === 'skeleton' ? <Skeleton text="card-title" width="7rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="7rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      tableView={state === 'default' && props.bars.length > 0}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {body}
    </CardFrame>
  )

  // No bars is empty; a bar of zero is data and draws on the baseline.
  if (state === 'empty' || state === 'error' || state === 'warming' || (state === 'default' && n === 0)) {
    return frame(
      <div className={styles.stateBody}>
        {(state === 'empty' || state === 'default') && (
          <StateRow kind="empty" emptyTone={props.emptyTone ?? 'neutral'} title={props.empty ?? BAR_EMPTY} meta={props.emptyMeta} />
        )}
        {state === 'error' && (
          <StateRow kind="error" title={error?.failed} meta={error?.cause} action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>} />
        )}
        {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
      </div>,
    )
  }

  const scale = barScale(props)
  const ticksDesc = [...scale.ticks].reverse()
  const widestTick = ticksDesc.map(formatTick).reduce((a, b) => (b.length > a.length ? b : a), '')
  const unitWords = UNIT_WORDS[unit]

  const ticks = (skeleton: boolean) => (
    <div className={styles.ticks} aria-hidden="true">
      <span className={styles.sizer}>{widestTick}</span>
      {ticksDesc.map((t, i) => (
        <span key={t} className={styles.tick} data-tick={skeleton ? undefined : ''} style={{ top: `${(i / (ticksDesc.length - 1)) * 100}%` }}>
          {skeleton ? <SkeletonBlock width="1rem" height="calc(var(--text-axis-size) * 0.7)" /> : formatTick(t)}
        </span>
      ))}
    </div>
  )
  const gridlines = (skeleton: boolean) =>
    ticksDesc.map((t, i) => (
      <span
        key={t}
        className={styles.grid}
        data-skeleton={skeleton ? '' : undefined}
        data-baseline={!skeleton && t === 0 ? '' : undefined}
        style={{ top: `${(i / (ticksDesc.length - 1)) * 100}%` }}
      />
    ))

  if (state === 'skeleton') {
    const slots = Math.max(n, 6)
    return frame(
      <div className={styles.body} aria-hidden="true">
        <div className={styles.chart}>
          {ticks(true)}
          <div ref={plotRef} className={styles.plot}>
            {gridlines(true)}
          </div>
          <span />
          <div className={styles.axis}>
            {Array.from({ length: slots }, (_, i) => (
              <span key={i} className={styles.category}>
                <SkeletonBlock width="60%" height="calc(var(--text-axis-size) * 0.7)" />
              </span>
            ))}
          </div>
        </div>
        <span className="sr-only">Loading {title}.</span>
      </div>,
    )
  }

  // Every bar carries its value while a band has room for one; otherwise only the largest does.
  const countsAll = bandCount.plot / n >= bandCount.min
  const largest = bars.reduce((best, b, i) => (b.value > bars[best]!.value ? i : best), 0)

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHover(Math.min(n - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * n))))
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, (i: number) => number> = {
      ArrowRight: i => Math.min(n - 1, i + 1),
      ArrowLeft: i => Math.max(0, i - 1),
      Home: () => 0,
      End: () => n - 1,
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    setHover(i => step(i ?? 0))
  }

  const valueWords = (v: number) => `${formatChartValue(v, unit)}${unitWords ? ` ${unitWords}` : ''}`
  const hovered = hover === null ? undefined : bars[hover]

  return frame(
    <div className={styles.body}>
      <div className={styles.chart} data-chart-body="">
        {ticks(false)}
        <div
          ref={plotRef}
          className={styles.plot}
          role="img"
          aria-label={chartLabel(props)}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          data-plot=""
        >
          {gridlines(false)}
          <div className={styles.bands} aria-hidden="true">
            {bars.map((b, i) => (
              <span key={b.key} className={styles.band}>
                <span className={styles.bar} data-bar={b.key} data-hover={hover === i || undefined} style={{ height: `${barHeight(b.value, scale.max)}%` }}>
                  {(countsAll || i === largest) && (
                    <span className={styles.count} data-value="">
                      {formatChartValue(b.value, unit)}
                    </span>
                  )}
                </span>
              </span>
            ))}
          </div>
          {hovered && hover !== null && (
            <span
              className={styles.tooltip}
              data-side={bandCenter(hover, n) > 55 ? 'left' : 'right'}
              style={{ '--x': `${bandCenter(hover, n)}%` } as CSSProperties}
              aria-hidden="true"
            >
              <b className={styles.tipValue}>
                {formatChartValue(hovered.value, unit)}
                {unitWords && <small className={styles.unit}>{unitWords}</small>}
              </b>
              <span className={styles.tipName}>{hovered.label}</span>
            </span>
          )}
        </div>
        <span />
        <div className={styles.axis} aria-hidden="true">
          {bars.map((b, i) => (
            <span key={b.key} className={styles.category} data-hover={hover === i || undefined} title={b.label}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {hovered ? `${hovered.label}: ${valueWords(hovered.value)}` : ''}
      </p>
      <table className="sr-only" data-table-view="">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{BY_WORDS[by].column}</th>
            <th scope="col">
              {title}
              {unitWords ? ` (${unitWords})` : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          {bars.map(b => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{formatChartValue(b.value, unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
  )
}

