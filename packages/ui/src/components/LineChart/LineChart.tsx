'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createLogger } from '@genui-github/core'
import {
  bandCenter,
  formatChartValue,
  formatTick,
  isLabeled,
  labelEvery,
  linePath,
  niceScale,
  UNIT_WORDS,
  weekLabel,
  yPercent,
} from '../../charts/scale'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { seriesFacts, validateNumbers } from '../../validate/numbers'
import type { LineChartProps } from './schema'
import styles from './LineChart.module.css'

const log = createLogger('ui:linechart')

// Read from tokens.css at mount; these only steer layout decisions, never paint.
const LABEL_GAP_FALLBACK = 64
const BAND_COUNT_FALLBACK = 32
const END_LABEL_FALLBACK = 17

function cssPx(el: Element, name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

function lastPoint(points: (number | null)[]): { i: number; v: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]
    if (typeof v === 'number') return { i, v }
  }
  return null
}

/** The aria-label: the model's finding when its numbers check out, else the system's own summary. */
export function chartLabel(props: LineChartProps): string {
  const allowed = [...props.series.flatMap(s => seriesFacts(s.points)), ...(props.failures ? seriesFacts(props.failures) : [])]
  const check = validateNumbers(props.finding, allowed)
  if (check.ok) return props.finding
  log.warn('linechart finding did not match its series', { mismatches: check.mismatches.map(m => m.raw) })
  const latest = lastPoint(props.series[0]?.points ?? [])
  const unit = UNIT_WORDS[props.unit]
  return `${props.title} over ${props.weeks.length} weeks${latest ? `, latest ${formatChartValue(latest.v, props.unit)}${unit ? ` ${unit}` : ''}` : ''}.`
}

export function LineChart({ props, state, error, warming, onRetry }: PieceRenderProps<LineChartProps>) {
  const { title, meta, series, weeks, failures, unit } = props
  const plotRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 560, height: 200, labelGap: LABEL_GAP_FALLBACK, bandCount: BAND_COUNT_FALLBACK, endLabel: END_LABEL_FALLBACK })
  const [hover, setHover] = useState<number | null>(null)
  const n = weeks.length

  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const read = () => {
      // Until there is a layout (or under a test DOM), keep the defaults rather than a zero-size plot.
      if (!el.clientWidth || !el.clientHeight) return
      setBox({
        width: el.clientWidth,
        height: el.clientHeight,
        labelGap: cssPx(el, '--label-gap', LABEL_GAP_FALLBACK),
        bandCount: cssPx(el, '--band-count', BAND_COUNT_FALLBACK),
        endLabel: cssPx(el, '--text-card-title-size', 13) * cssPx(el, '--text-card-title-leading', 1.3),
      })
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [state])

  const legend = series.length > 1 || Boolean(failures)
  const frame = (body: React.ReactNode) => (
    <CardFrame
      as="figure"
      title={state === 'skeleton' ? <Skeleton text="card-title" width="7rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="7rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {body}
    </CardFrame>
  )

  if (state === 'empty' || state === 'error' || state === 'warming') {
    return frame(
      <div className={styles.stateBody}>
        {state === 'empty' && <StateRow kind="empty" emptyTone={props.emptyTone ?? 'neutral'} title={props.empty ?? 'Nothing to chart yet'} meta={props.emptyMeta} />}
        {state === 'error' && (
          <StateRow kind="error" title={error?.failed} meta={error?.cause} action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>} />
        )}
        {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
      </div>,
    )
  }

  const scale = niceScale(Math.max(0, ...series.flatMap(s => s.points.filter((p): p is number => p !== null))))
  const ticksDesc = [...scale.ticks].reverse()
  const widestTick = ticksDesc.map(formatTick).reduce((a, b) => (b.length > a.length ? b : a), '')
  const band = box.width / Math.max(n, 1)
  const every = labelEvery(band, box.labelGap)
  const unitWords = UNIT_WORDS[unit]

  if (state === 'skeleton') {
    return frame(
      <div className={styles.body} aria-hidden="true">
        {legend && (
          <div className={styles.legend}>
            <SkeletonBlock width="6rem" height="var(--text-label-size)" />
            <SkeletonBlock width="5rem" height="var(--text-label-size)" />
          </div>
        )}
        <div className={styles.chart}>
          <div className={styles.ticks}>
            <span className={styles.sizer}>{widestTick}</span>
            {ticksDesc.map((t, i) => (
              <span key={t} className={styles.tick} style={{ top: `${(i / (ticksDesc.length - 1)) * 100}%` }}>
                <SkeletonBlock width="1rem" height="calc(var(--text-axis-size) * 0.7)" />
              </span>
            ))}
          </div>
          <div ref={plotRef} className={styles.plot}>
            {ticksDesc.map((t, i) => (
              <span key={t} className={styles.grid} data-skeleton="" style={{ top: `${(i / (ticksDesc.length - 1)) * 100}%` }} />
            ))}
          </div>
          <span />
          <span />
          <div className={styles.axis}>
            {weeks.map((w, i) =>
              isLabeled(i, n, every) ? (
                <span key={w} className={styles.week} style={{ left: `${bandCenter(i, n)}%` }}>
                  <SkeletonBlock width="2.25rem" height="calc(var(--text-axis-size) * 0.7)" />
                </span>
              ) : null,
            )}
          </div>
        </div>
        <span className="sr-only">Loading {title}.</span>
      </div>,
    )
  }

  // End labels sit on their lines; when two would touch, the lower one drops and the legend and tooltip carry it.
  const ends = series
    .map((s, si) => ({ si, last: lastPoint(s.points) }))
    .filter((e): e is { si: number; last: { i: number; v: number } } => e.last !== null)
    .map(e => ({ ...e, y: yPercent(e.last.v, scale.max) }))
  const shownEnds = ends.filter(e => !ends.some(o => o !== e && o.y < e.y && ((e.y - o.y) / 100) * box.height < box.endLabel))

  const failMax = failures ? Math.max(1, ...failures) : 1
  const countsAll = band >= box.bandCount

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const i = Math.min(n - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * n)))
    setHover(i)
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
    setHover(i => step(i ?? n - 1))
  }

  const announce =
    hover === null
      ? ''
      : `Week of ${weekLabel(weeks[hover]!)}: ${series
          .map(s => `${s.name} ${s.points[hover] === null ? 'no data' : `${formatChartValue(s.points[hover]!, unit)}${unitWords ? ` ${unitWords}` : ''}`}`)
          .join(', ')}${failures ? `, ${failures[hover]} failed runs` : ''}`

  return frame(
    <div className={styles.body}>
      {legend && (
        <ul className={styles.legend} aria-hidden="true">
          {series.map((s, si) => (
            <li key={s.name} data-series={si}>
              <span className={styles.lineKey} />
              {s.name}
            </li>
          ))}
          {failures && (
            <li>
              <span className={styles.columnKey} />
              Failed runs
            </li>
          )}
        </ul>
      )}
      <div className={styles.chart} data-failures={failures ? '' : undefined}>
        <div className={styles.ticks} aria-hidden="true">
          <span className={styles.sizer}>{widestTick}</span>
          {ticksDesc.map((t, i) => (
            <span key={t} className={styles.tick} data-tick="" style={{ top: `${(i / (ticksDesc.length - 1)) * 100}%` }}>
              {formatTick(t)}
            </span>
          ))}
        </div>
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
          {ticksDesc.map((t, i) => (
            <span key={t} className={styles.grid} data-baseline={t === 0 || undefined} data-gridline="" style={{ top: `${(i / (ticksDesc.length - 1)) * 100}%` }} />
          ))}
          {/* One layer per series, so each draws on its own; data-1 is last, on top. */}
          {[...series.keys()].reverse().map(si => (
            <svg key={si} className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none" data-series-layer={si} aria-hidden="true">
              <path className={styles.line} data-series={si} data-line="" d={linePath(series[si]!.points, scale.max)} />
            </svg>
          ))}
          {hover !== null && (
            <>
              <span className={styles.crosshair} style={{ left: `${bandCenter(hover, n)}%` }} aria-hidden="true" />
              {series.map((s, si) =>
                s.points[hover] === null ? null : (
                  <span
                    key={si}
                    className={styles.dot}
                    data-series={si}
                    style={{ left: `${bandCenter(hover, n)}%`, top: `${yPercent(s.points[hover]!, scale.max)}%` }}
                    aria-hidden="true"
                  />
                ),
              )}
              <span
                className={styles.tooltip}
                data-side={bandCenter(hover, n) > 55 ? 'left' : 'right'}
                style={{ '--x': `${bandCenter(hover, n)}%` } as CSSProperties}
                aria-hidden="true"
              >
                {series.map((s, si) => (
                  <span key={si} className={styles.tipRow} data-series={si}>
                    <span className={styles.tipKey} />
                    <b className={styles.tipValue}>
                      {s.points[hover] === null ? ' ' : formatChartValue(s.points[hover]!, unit)}
                      {unitWords && <small className={styles.unit}>{unitWords}</small>}
                    </b>
                    <span className={styles.tipName}>{s.name}</span>
                  </span>
                ))}
              </span>
            </>
          )}
          {ends.map(e => (
            <span
              key={e.si}
              className={styles.dot}
              data-series={e.si}
              data-endpoint=""
              style={{ left: `${bandCenter(e.last.i, n)}%`, top: `${e.y}%` }}
              aria-hidden="true"
            />
          ))}
          {shownEnds.map(e => (
            <span
              key={e.si}
              className={styles.endLabel}
              data-end-label=""
              style={{ left: `${bandCenter(e.last.i, n)}%`, top: `${e.y}%` }}
              aria-hidden="true"
            >
              <b data-end-value="">{formatChartValue(e.last.v, unit)}</b>
              {unitWords && <small className={styles.unit}>{unitWords}</small>}
            </span>
          ))}
        </div>
        <div className={styles.endZone} aria-hidden="true">
          {ends.length > 0 && (
            <span className={styles.endSizer}>
              <b>{ends.map(e => formatChartValue(e.last.v, unit)).reduce((a, b) => (b.length > a.length ? b : a), '')}</b>
              {unitWords && <small className={styles.unit}>{unitWords}</small>}
            </span>
          )}
        </div>
        {failures && (
          <>
            <span />
            <div className={styles.strip} aria-hidden="true" data-strip="">
              {failures.map((f, i) => (
                <span key={i} className={styles.band}>
                  <span className={styles.column} data-column="" style={{ height: `${(f / failMax) * 100}%` }}>
                    {(countsAll || i === 0 || i === n - 1) && <span className={styles.count}>{f}</span>}
                  </span>
                </span>
              ))}
            </div>
            <span />
          </>
        )}
        <span />
        <div className={styles.axis} aria-hidden="true">
          {weeks.map((w, i) =>
            isLabeled(i, n, every) ? (
              <span key={w} className={styles.week} data-hover={hover === i || undefined} style={{ left: `${bandCenter(i, n)}%` }}>
                {weekLabel(w)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <table className="sr-only" data-table-view="">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            {series.map(s => (
              <th key={s.name} scope="col">
                {s.name}
                {unitWords ? ` (${unitWords})` : ''}
              </th>
            ))}
            {failures && <th scope="col">Failed runs</th>}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={w}>
              <th scope="row">{weekLabel(w)}</th>
              {series.map(s => (
                <td key={s.name}>{s.points[i] === null ? 'no data' : formatChartValue(s.points[i]!, unit)}</td>
              ))}
              {failures && <td>{failures[i]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
  )
}
