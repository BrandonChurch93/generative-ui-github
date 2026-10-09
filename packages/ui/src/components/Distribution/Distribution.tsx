'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createLogger } from '@genui-github/core'
import { bandCenter, formatTick } from '../../charts/scale'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { ComponentState, PieceRenderProps } from '../../types'
import {
  BIN_COUNT,
  BIN_SHORT,
  binOf,
  binSentence,
  countScale,
  EDGE_LABELS,
  findingSentence,
  itemWord,
  MARKER_WORDS,
  MEASURE_WORDS,
  roundDuration,
  shareWords,
  shortDuration,
  sourceLine,
  type DistributionProps,
} from './schema'
import styles from './Distribution.module.css'

const log = createLogger('ui:distribution')

// Read from tokens.css at mount; these only steer layout decisions, never paint.
const FALLBACK = {
  wideMin: 480,
  bandCount: 32,
  flagGap: 10,
  sideGap: 8,
  tipGap: 12,
  shapeHalf: 20,
}

// A skeleton previews a plausible spread, never real data.
const SKELETON_HEIGHTS = ['30%', '46%', '58%', '70%', '64%', '44%', '26%']

function cssPx(el: Element, name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

const binCenter = (i: number) => bandCenter(i, BIN_COUNT)
const edgePct = (j: number) => ((j + 1) / BIN_COUNT) * 100

interface Box {
  wide: boolean
  width: number
  height: number
  wideMin: number
  bandCount: number
  flagGap: number
  sideGap: number
  tipGap: number
  shapeHalf: number
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5

export function Distribution({ props, state, error, warming, onRetry }: PieceRenderProps<DistributionProps>) {
  const { title, meta, measure, counts } = props
  const bodyRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const markerLabelRef = useRef<HTMLSpanElement>(null)
  const p90LabelRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const binRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [box, setBox] = useState<Box>({ wide: true, width: 560, height: 200, ...FALLBACK })
  const [flip, setFlip] = useState({ marker: false, p90: false })
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const [stop, setStop] = useState(0)

  const malformed = counts.length !== BIN_COUNT || counts.some(c => !Number.isFinite(c) || c < 0)
  const total = malformed ? 0 : counts.reduce((a, b) => a + b, 0)
  const shown: ComponentState = state === 'default' ? (malformed ? 'error' : total === 0 ? 'empty' : 'default') : state

  useEffect(() => {
    if (state === 'default' && malformed) log.warn('distribution counts do not fit the bin ladder', { bins: counts.length })
  }, [state, malformed, counts.length])

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const read = () => {
      const card = body.closest('[data-card]') ?? body
      const cardWidth = card.getBoundingClientRect().width
      // Until there is a layout (or under a test DOM), keep the defaults rather than a zero-size plot.
      if (!cardWidth) return
      const area = areaRef.current
      const plot = plotRef.current
      const next: Box = {
        wideMin: cssPx(body, '--chart-wide', FALLBACK.wideMin),
        bandCount: cssPx(body, '--band-count', FALLBACK.bandCount),
        flagGap: cssPx(body, '--endpoint', 8) / 2 + cssPx(body, '--ring', 2) + cssPx(body, '--space-1', 4),
        sideGap: cssPx(body, '--space-2', FALLBACK.sideGap),
        tipGap: cssPx(body, '--space-3', FALLBACK.tipGap),
        shapeHalf: cssPx(body, '--col-max', 24) / 2 + cssPx(body, '--space-2', 8),
        wide: true,
        width: area?.clientWidth || 560,
        height: plot?.clientHeight || 200,
      }
      next.wide = cardWidth >= next.wideMin
      setBox(prev => ((Object.keys(next) as (keyof Box)[]).every(k => prev[k] === next[k]) ? prev : next))
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(body)
    if (areaRef.current) observer.observe(areaRef.current)
    return () => observer.disconnect()
  }, [shown])

  const scale = countScale(malformed ? 0 : Math.max(0, ...counts))
  const gridTicks = scale.ticks.slice(1, -1)
  const widestTick = gridTicks.map(formatTick).reduce((a, b) => (b.length > a.length ? b : a), '')
  const medianBin = binOf(props.medianMinutes)
  const p90Bin = binOf(props.p90Minutes)
  const active = hover ?? focus
  const showP90 = box.wide && props.showP90 !== false

  // Flags flip left of their rule when they would cross the content edge, and the tooltip clamps inside the plot.
  // The wording sets the label widths, so a change of perspective or value re-measures them.
  useLayoutEffect(() => {
    if (shown !== 'default') return
    const { width, height } = box
    const fits = (bin: number, gap: number, label: HTMLElement | null) => (binCenter(bin) / 100) * width + gap + (label?.offsetWidth ?? 0) <= width
    const marker = !fits(medianBin, box.flagGap, markerLabelRef.current)
    const p90 = !fits(p90Bin, box.sideGap, p90LabelRef.current)
    setFlip(prev => (prev.marker === marker && prev.p90 === p90 ? prev : { marker, p90 }))

    const node = tipRef.current
    if (active === null || !node) {
      setTip(prev => (prev === null ? prev : null))
      return
    }
    const [tw, th] = [node.offsetWidth, node.offsetHeight]
    const clamp = (x: number) => Math.min(Math.max(0, x), Math.max(0, width - tw))
    const center = (binCenter(active) / 100) * width
    const barTop = height * (1 - (counts[active] ?? 0) / scale.max)
    let top = barTop - box.tipGap - th
    let left = clamp(center - tw / 2)
    // Above a tall bar there is no room under the lane, so the tooltip sits beside the hover shape instead.
    if (top < 0) {
      top = 0
      left = clamp(active < BIN_COUNT / 2 ? center + box.shapeHalf + box.tipGap : center - box.shapeHalf - box.tipGap - tw)
    }
    setTip(prev => (prev && near(prev.left, left) && near(prev.top, top) ? prev : { left, top }))
  }, [shown, box, medianBin, p90Bin, active, counts, scale.max, props.perspective, props.medianMinutes, props.p90Minutes, showP90])

  const frame = (body: ReactNode) => (
    <CardFrame
      as="figure"
      title={state === 'skeleton' ? <Skeleton text="card-title" width="9rem" /> : title}
      meta={state === 'skeleton' ? <Skeleton text="meta" width="5rem" /> : meta}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      tableView={state === 'default'}
      ariaLabel={state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      {body}
    </CardFrame>
  )

  if (shown === 'empty' || shown === 'error' || shown === 'warming') {
    const failed = malformed && state === 'default'
    return frame(
      <div ref={bodyRef} className={styles.stateBody}>
        {shown === 'empty' && (
          <StateRow
            kind="empty"
            emptyTone={props.emptyTone ?? 'neutral'}
            title={props.empty ?? MEASURE_WORDS[measure].empty[props.population]}
            meta={props.emptyMeta}
          />
        )}
        {shown === 'error' && (
          <StateRow
            kind="error"
            title={failed ? "Couldn't draw this chart" : error?.failed}
            meta={failed ? `the data had ${counts.length} bins, not ${BIN_COUNT}` : error?.cause}
            action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
          />
        )}
        {shown === 'warming' && <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />}
      </div>,
    )
  }

  const width = box.wide ? 'wide' : 'narrow'
  const thin = box.width / BIN_COUNT < box.bandCount
  const gutter = box.wide ? (
    <div className={styles.ticks} aria-hidden="true">
      <span className={styles.sizer}>{shown === 'skeleton' ? '' : widestTick}</span>
      {shown === 'default' &&
        gridTicks.map(t => (
          <span key={t} className={styles.tick} data-tick="" style={{ bottom: `${(t / scale.max) * 100}%` }}>
            {formatTick(t)}
          </span>
        ))}
    </div>
  ) : (
    <span />
  )

  if (shown === 'skeleton') {
    return frame(
      <div ref={bodyRef} className={styles.body} data-width={width}>
        <div aria-hidden="true">
          <div className={styles.chart}>
            {gutter}
            <div ref={areaRef} className={styles.area}>
              <div ref={plotRef} className={styles.plot}>
                <div className={styles.bins}>
                  {SKELETON_HEIGHTS.map((h, i) => (
                    <span key={i} className={styles.skBin}>
                      <SkeletonBlock className={styles.skBar} width="min(var(--col-max), calc(100% - var(--hairline) * 2))" height={h} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span />
            <div className={styles.axis}>
              {EDGE_LABELS.map((label, j) => (
                <span key={label} className={styles.edgeSkeleton} style={{ left: `${edgePct(j)}%` }}>
                  <SkeletonBlock width="var(--space-4)" height="calc(var(--text-axis-size) * 0.7)" />
                </span>
              ))}
            </div>
          </div>
          <div className={styles.source}>
            <Skeleton text="meta" width="60%" />
          </div>
        </div>
        <span className="sr-only">Loading {title}.</span>
      </div>,
    )
  }

  const words = MEASURE_WORDS[measure]
  const perspective = props.perspective ?? 'reader'
  const median = roundDuration(props.medianMinutes)
  const p90 = roundDuration(props.p90Minutes)

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, (i: number) => number> = {
      ArrowRight: i => Math.min(BIN_COUNT - 1, i + 1),
      ArrowLeft: i => Math.max(0, i - 1),
      Home: () => 0,
      End: () => BIN_COUNT - 1,
    }
    const step = steps[event.key]
    if (!step) return
    event.preventDefault()
    binRefs.current[step(focus ?? stop)]?.focus()
  }

  return frame(
    <div ref={bodyRef} className={styles.body} data-width={width} data-perspective={perspective}>
      <div role="group" aria-label={findingSentence(props)}>
        <div className={styles.chart} data-chart-body="">
          {gutter}
          <div ref={areaRef} className={styles.area}>
            <div ref={plotRef} className={styles.plot}>
              {box.wide &&
                gridTicks.map(t => (
                  <span key={t} className={styles.grid} data-gridline="" style={{ bottom: `${(t / scale.max) * 100}%` }} aria-hidden="true" />
                ))}
              {showP90 && (
                <span className={styles.p90} data-p90="" data-flip={flip.p90 || undefined} style={{ left: `${binCenter(p90Bin)}%` }} aria-hidden="true">
                  <span ref={p90LabelRef} className={styles.p90Label} data-p90-label="">
                    90% by {shortDuration(p90)}
                  </span>
                </span>
              )}
              <div className={styles.bins} onKeyDown={onKey}>
                {counts.map((count, i) => (
                  <button
                    key={i}
                    ref={node => {
                      binRefs.current[i] = node
                    }}
                    type="button"
                    className={styles.bin}
                    tabIndex={i === stop ? 0 : -1}
                    aria-label={binSentence(measure, i, count)}
                    data-bin={i}
                    data-active={active === i || undefined}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => {
                      setFocus(i)
                      setStop(i)
                    }}
                    onBlur={() => setFocus(null)}
                  >
                    <span className={styles.bar} data-bar="" style={{ height: `${(count / scale.max) * 100}%` }} />
                  </button>
                ))}
              </div>
              {active !== null && (
                <span
                  ref={tipRef}
                  className={styles.tooltip}
                  data-placed={tip ? '' : undefined}
                  style={tip ? { left: `${tip.left}px`, top: `${tip.top}px` } : undefined}
                  aria-hidden="true"
                >
                  <b className={styles.tipCount}>
                    <span className={styles.tipKey} />
                    {counts[active]} {itemWord(measure, counts[active] ?? 0)}
                  </b>
                  <span className={styles.tipMeta}>
                    {BIN_SHORT[active]} · {shareWords(counts[active] ?? 0, total)}
                  </span>
                </span>
              )}
              <span className={styles.baseline} data-baseline="" aria-hidden="true" />
            </div>
            <span className={styles.marker} data-marker="" style={{ left: `${binCenter(medianBin)}%` }} aria-hidden="true">
              <span className={styles.stem} data-stem="" />
              <span className={styles.cap} data-cap="" />
              <span ref={markerLabelRef} className={styles.markerLabel} data-marker-label="" data-flip={flip.marker || undefined}>
                {MARKER_WORDS[perspective][width]} <i>·</i> about <b data-marker-value="">{shortDuration(median)}</b>
              </span>
            </span>
          </div>
          <span />
          <div className={styles.axis} aria-hidden="true">
            {EDGE_LABELS.map((label, j) =>
              thin && j % 2 === 0 ? null : (
                <span
                  key={label}
                  className={styles.edge}
                  data-edge=""
                  data-on={(active !== null && (j === active - 1 || j === active)) || undefined}
                  style={{ left: `${edgePct(j)}%` }}
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </div>
        <p className={styles.source} data-source="">
          {sourceLine(props, total, box.wide)}
        </p>
        <table className="sr-only" data-table-view="">
          <caption>{meta ? `${title} · ${meta}` : title}</caption>
          <thead>
            <tr>
              <th scope="col">{words.table}</th>
              <th scope="col">{words.many}</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((count, i) => (
              <tr key={i}>
                <th scope="row">{BIN_SHORT[i]}</th>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
  )
}
