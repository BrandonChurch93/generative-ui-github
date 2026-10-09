'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import {
  cellName,
  fillAsk,
  hourLabel,
  HOURS,
  peakCells,
  peakLine,
  peakOf,
  STEPS,
  stepOf,
  timeLabel,
  unitWord,
  heatmapLabel,
  type Cell,
} from './heat'
import { DAYS, UNIT_WORDS, WINDOW_LABELS, type HeatmapProps } from './schema'
import styles from './Heatmap.module.css'

// Read from tokens.css at mount; these only steer layout decisions, never paint.
const ROW_Y_FALLBACK = 12
const SPACE_2_FALLBACK = 8

function cssPx(el: Element, name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

const HOUR_INDEXES = Array.from({ length: HOURS }, (_, h) => h)
const STEP_INDEXES = Array.from({ length: STEPS }, (_, i) => i + 1)
const sameCell = (a: Cell | null, b: Cell) => a !== null && a.day === b.day && a.hour === b.hour

interface Tip {
  cell: Cell
  x: number
  top: number
  bottom: number
}

export function Heatmap({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<HeatmapProps>) {
  const { title, unit, window, zone, counts, cellAsk } = props
  const plotRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [every, setEvery] = useState(3)
  const [tip, setTip] = useState<Tip | null>(null)
  const peaks = state === 'default' ? peakCells(counts) : []
  const [moved, setCursor] = useState<Cell | null>(null)
  // The one tab stop enters at the peak until the reader moves it.
  const cursor = moved ?? peaks[0] ?? { day: 0, hour: 0 }

  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    // Compact labels every 6 hours, the others every 3. Density reaches the component only through its variables.
    const read = () => setEvery(cssPx(el, '--row-y', ROW_Y_FALLBACK) <= cssPx(el, '--space-2', SPACE_2_FALLBACK) ? 6 : 3)
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [state])

  // The tooltip centers on its cell but never past the plot's edges, where the card would clip it.
  useLayoutEffect(() => {
    const el = tipRef.current
    const plot = plotRef.current
    if (!el || !plot || !tip) return
    const half = el.offsetWidth / 2
    const width = plot.clientWidth
    el.style.left = `${width > 2 * half ? Math.min(Math.max(tip.x, half), width - half) : tip.x}px`
  }, [tip])

  const meta = `${WINDOW_LABELS[window].words} · ${zone}`
  const frame = (body: React.ReactNode) => (
    <CardFrame
      as="figure"
      title={state === 'skeleton' ? <Skeleton text="card-title" width="9rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="6rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      tableView={state === 'default'}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {body}
    </CardFrame>
  )

  if (state === 'empty' || state === 'error' || state === 'warming') {
    return frame(
      <div className={styles.message}>
        {state === 'empty' && (
          <StateRow
            kind="empty"
            emptyTone={props.emptyTone ?? 'neutral'}
            title={props.empty ?? `No ${UNIT_WORDS[unit].many} in the ${WINDOW_LABELS[window].words}`}
            meta={props.emptyMeta}
          />
        )}
        {state === 'error' && (
          <StateRow kind="error" title={error?.failed} meta={error?.cause} action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>} />
        )}
        {state === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
      </div>,
    )
  }

  const hours = (label: (h: number) => React.ReactNode) => (
    <div className={styles.hours} aria-hidden="true" data-hours="">
      {HOUR_INDEXES.map(h => (
        <span key={h} className={styles.hour}>
          {h % every === 0 ? label(h) : null}
        </span>
      ))}
    </div>
  )

  if (state === 'skeleton') {
    return frame(
      <div className={styles.body} aria-hidden="true">
        <div className={styles.plot}>
          <div ref={fieldRef} className={styles.field}>
            <div className={styles.matrix}>
              <div className={styles.days}>
                {DAYS.map(d => (
                  <span key={d.short} className={styles.day}>
                    <SkeletonBlock width="100%" height="calc(var(--text-axis-size) * 0.7)" />
                  </span>
                ))}
              </div>
              <div className={styles.rows}>
                {DAYS.map(d => (
                  <div key={d.short} className={styles.row}>
                    <span className={styles.sizer} />
                    <SkeletonBlock className={styles.bar} width="auto" height="auto" />
                  </div>
                ))}
              </div>
              {hours(() => (
                <SkeletonBlock width="1.2em" height="calc(var(--text-axis-size) * 0.7)" />
              ))}
            </div>
          </div>
        </div>
        <div className={styles.foot}>
          <Skeleton text="meta" width="7.5rem" />
          <Skeleton text="meta" width="11rem" />
        </div>
        <span className="sr-only">Loading {title}.</span>
      </div>,
    )
  }

  const peak = peakOf(counts)
  const peakDays = new Set(peaks.map(p => p.day))
  const asks = Boolean(cellAsk && onAsk)

  const show = (cell: Cell, target: HTMLElement) => {
    const plot = plotRef.current
    if (!plot) return
    const p = plot.getBoundingClientRect()
    const r = target.getBoundingClientRect()
    setTip({ cell, x: r.left + r.width / 2 - p.left, top: r.top - p.top, bottom: r.bottom - p.top })
  }

  const target = (cell: Cell) => fieldRef.current?.querySelector<HTMLElement>(`[data-target="${cell.day}-${cell.hour}"]`)

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, (c: Cell) => Cell> = {
      ArrowRight: c => ({ ...c, hour: Math.min(HOURS - 1, c.hour + 1) }),
      ArrowLeft: c => ({ ...c, hour: Math.max(0, c.hour - 1) }),
      ArrowDown: c => ({ ...c, day: Math.min(DAYS.length - 1, c.day + 1) }),
      ArrowUp: c => ({ ...c, day: Math.max(0, c.day - 1) }),
      Home: c => ({ ...c, hour: 0 }),
      End: c => ({ ...c, hour: HOURS - 1 }),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const next = move(cursor)
    setCursor(next)
    target(next)?.focus()
  }

  const tipCell = tip?.cell
  const tipCount = tipCell ? (counts[tipCell.day]?.[tipCell.hour] ?? 0) : 0

  return frame(
    <div className={styles.body}>
      <div ref={plotRef} className={styles.plot} role="group" aria-label={heatmapLabel(props)} data-plot="" data-chart-body="">
        <div ref={fieldRef} className={styles.field} onScroll={() => setTip(null)}>
          <div className={styles.matrix}>
            <div className={styles.days} aria-hidden="true">
              {DAYS.map((d, i) => (
                <span key={d.short} className={styles.day} data-peak-day={peakDays.has(i) || undefined}>
                  {d.short}
                </span>
              ))}
            </div>
            <div
              className={styles.rows}
              role="grid"
              aria-label={`${title} · ${meta}`}
              onKeyDown={onKey}
              onPointerLeave={() => setTip(null)}
              data-heat=""
            >
              {DAYS.map((d, day) => (
                <div key={d.short} className={styles.row} role="row" data-row={day}>
                  {HOUR_INDEXES.map(hour => {
                    const cell = { day, hour }
                    const count = counts[day]?.[hour] ?? 0
                    const name = cellName(day, hour, count, unit)
                    const focus = {
                      'data-target': `${day}-${hour}`,
                      tabIndex: sameCell(cursor, cell) ? 0 : -1,
                      onFocus: (e: React.FocusEvent<HTMLElement>) => {
                        setCursor(cell)
                        show(cell, e.currentTarget)
                      },
                      onBlur: () => setTip(null),
                    }
                    return (
                      <span
                        key={hour}
                        className={styles.cell}
                        role="gridcell"
                        data-cell=""
                        data-hour={hour}
                        data-step={stepOf(count, peak)}
                        data-active={sameCell(tip?.cell ?? null, cell) || undefined}
                        onPointerEnter={e => show(cell, e.currentTarget)}
                        {...(asks ? {} : { ...focus, 'aria-label': name })}
                      >
                        {asks && (
                          <button
                            type="button"
                            className={styles.cellButton}
                            aria-label={name}
                            onClick={() => onAsk!(fillAsk(cellAsk!, day, hour))}
                            {...focus}
                          />
                        )}
                        {peaks.some(p => sameCell(p, cell)) && <span className={styles.dot} data-peak-dot="" aria-hidden="true" />}
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
            {hours(hourLabel)}
          </div>
        </div>
        {tipCell && (
          <span
            ref={tipRef}
            className={styles.tip}
            data-flip={tipCell.day < 2 || undefined}
            style={{ '--tip-top': `${tip.top}px`, '--tip-bottom': `${tip.bottom}px` } as CSSProperties}
            aria-hidden="true"
            data-tip=""
          >
            <b className={styles.tipCount}>
              <i className={styles.tipKey} data-step={stepOf(tipCount, peak)} />
              {tipCount}
              <em className={styles.tipUnit}>{unitWord(unit, tipCount)}</em>
            </b>
            <span className={styles.tipWhen}>
              {DAYS[tipCell.day]!.short} {timeLabel(tipCell.hour)}
            </span>
          </span>
        )}
      </div>
      <div className={styles.foot} data-chart-body="">
        <span className={styles.legend} aria-hidden="true" data-legend="">
          <span className={styles.legendGroup}>
            0
            <span className={styles.swatches} data-swatches="">
              <i className={styles.swatch} data-step={0} />
            </span>
          </span>
          <span className={styles.legendGroup}>
            1
            <span className={styles.swatches} data-swatches="">
              {STEP_INDEXES.map(s => (
                <i key={s} className={styles.swatch} data-step={s} />
              ))}
            </span>
            <span data-legend-high="">{peak}</span>
          </span>
        </span>
        <span className={styles.peak} data-peak-line="">
          <i className={styles.swatch} data-step={STEPS} aria-hidden="true">
            <span className={styles.dot} />
          </i>
          {peakLine(counts, unit)}
        </span>
      </div>
      {/* Twenty-four hour columns: the table view scrolls inside the card's padding. */}
      <div className={styles.tableWrap}>
        <table className="sr-only" data-table-view="">
          <caption>
            {title} · {meta}
          </caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {HOUR_INDEXES.map(h => (
                <th key={h} scope="col">
                  {hourLabel(h)}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody className={styles.tableCounts}>
            {DAYS.map((d, day) => (
              <tr key={d.short}>
                <th scope="row">{d.long}</th>
                {HOUR_INDEXES.map(h => (
                  <td key={h}>{counts[day]?.[h] ?? 0}</td>
                ))}
                <td>{(counts[day] ?? []).reduce((a, b) => a + b, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
  )
}
