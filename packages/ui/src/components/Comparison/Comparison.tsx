'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CardFrame, Skeleton, SkeletonBlock, StateRow, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import {
  absoluteChange,
  barShares,
  comparisonLabel,
  deltaFor,
  deltaWords,
  formatPairValue,
  rowSentence,
  rowValues,
  tally,
  UNIT_SUFFIX,
  verdictFor,
} from './reading'
import { COMPARISON_WORDS, type ComparisonPair, type ComparisonPeriods, type ComparisonProps, type PairUnit } from './schema'
import styles from './Comparison.module.css'

const k = (share: number) => ({ '--k': share }) as CSSProperties

/** `line` marks the bar's own tip value for motion; the tooltip's copy carries none. */
function Value({ value, unit, line }: { value: number; unit: PairUnit; line?: 'current' | 'previous' }) {
  return (
    <span className={styles.value}>
      <span data-value={line}>{formatPairValue(value, unit)}</span>
      {unit === 'percent' && '%'}
      {UNIT_SUFFIX[unit] && <small className={styles.unit}>{UNIT_SUFFIX[unit]}</small>}
    </span>
  )
}

function Tooltip({ pair, periods, share }: { pair: ComparisonPair; periods: ComparisonPeriods; share: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const change = absoluteChange(pair)
  const verdict = verdictFor(pair)

  // Opened at the current bar's tip, it may run past the content edge on a long bar; it slides back inside the row.
  useLayoutEffect(() => {
    const el = ref.current
    const row = el?.closest('li')
    if (!el || !row) return
    const edge = row.getBoundingClientRect().right - (parseFloat(getComputedStyle(row).getPropertyValue('--inset')) || 0)
    const over = el.getBoundingClientRect().right - edge
    el.style.setProperty('--shift', `${Math.max(0, over)}px`)
  }, [share])

  return (
    <span ref={ref} className={styles.tip} data-verdict={verdict} data-tooltip="" style={k(share)} aria-hidden="true">
      <span className={styles.tipKey} data-line="current" />
      <Value value={pair.current} unit={pair.unit} />
      <span className={styles.tipPeriod}>{periods.currentShort}</span>
      <span className={styles.tipChange}>
        {change.figure}
        {change.unit && <small className={styles.unit}>{change.unit}</small>}
      </span>
      <span className={styles.tipKey} data-line="previous" />
      <Value value={pair.previous} unit={pair.unit} />
      <span className={styles.tipPeriod}>{periods.previousShort}</span>
      <span className={styles.tipVerdict}>{verdict}</span>
    </span>
  )
}

interface RowProps {
  pair: ComparisonPair
  periods: ComparisonPeriods
  hovered: boolean
  onHover: (on: boolean) => void
  onAsk?: (ask: string) => void
}

function PairRow({ pair, periods, hovered, onHover, onAsk }: RowProps) {
  const shares = barShares(pair)
  const delta = deltaFor(pair)
  const verdict = verdictFor(pair)
  const interactive = pair.ask !== undefined && onAsk !== undefined
  const body = (
    <>
      <span className={styles.name}>
        <span className={styles.nameTitle}>{pair.name}</span>
        {pair.meta && <span className={styles.nameMeta}>{pair.meta}</span>}
      </span>
      <span className={styles.bars}>
        <span className={styles.lines} aria-hidden="true">
          <span className={styles.line} data-line="current">
            <span className={styles.bar} data-bar="current" data-flip-id={`${pair.measure}:${periods.current}`} style={k(shares.current)} />
            <Value value={pair.current} unit={pair.unit} line="current" />
          </span>
          <span className={styles.line} data-line="previous">
            <span className={styles.bar} data-bar="previous" data-flip-id={`${pair.measure}:${periods.previous}`} style={k(shares.previous)} />
            <Value value={pair.previous} unit={pair.unit} line="previous" />
          </span>
        </span>
        {hovered && <Tooltip pair={pair} periods={periods} share={shares.current} />}
      </span>
      {!interactive && <span className="sr-only">{rowValues(pair, periods)}</span>}
      <span className={styles.delta} data-verdict={verdict}>
        <b className={styles.deltaFigure}>
          <span data-delta="">{delta.figure}</span>
          {delta.unit === '%' ? '%' : delta.unit && <small className={styles.deltaUnit}>{delta.unit}</small>}
        </b>
        <span className={styles.verdict} data-verdict-word="">
          {verdict}
        </span>
      </span>
    </>
  )
  const hover = {
    onPointerEnter: () => onHover(true),
    onPointerLeave: () => onHover(false),
  }
  return (
    <li className={styles.item} data-row={pair.measure} data-hover={hovered || undefined}>
      <span className={styles.hairline} data-hairline="" aria-hidden="true" />
      {interactive ? (
        <button
          type="button"
          className={styles.row}
          aria-label={rowSentence(pair, periods)}
          onClick={() => onAsk(pair.ask!)}
          onFocus={() => onHover(true)}
          onBlur={() => onHover(false)}
          {...hover}
        >
          {body}
        </button>
      ) : (
        <div className={styles.row} {...hover}>
          {body}
        </div>
      )}
    </li>
  )
}

const SKELETON_ROWS: { name: [string, string]; bars: [number, number]; delta: [string, string] }[] = [
  { name: ['78%', '58%'], bars: [0.92, 0.68], delta: ['2.75rem', '2.25rem'] },
  { name: ['56%', '44%'], bars: [0.74, 0.86], delta: ['2.5rem', '2.5rem'] },
  { name: ['68%', '50%'], bars: [0.84, 0.6], delta: ['2.25rem', '2.5rem'] },
  { name: ['62%', '40%'], bars: [0.66, 0.9], delta: ['2.75rem', '2.25rem'] },
]

function SkeletonBody({ count }: { count: number }) {
  return (
    <>
      <ul className={styles.list} aria-hidden="true">
        {SKELETON_ROWS.slice(0, Math.min(4, Math.max(2, count))).map((row, i) => (
          <li key={i} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.name}>
                <span className={styles.skLine}>
                  <SkeletonBlock width={row.name[0]} height="calc(var(--text-row-title-size) * 0.7)" />
                </span>
                <span className={styles.skLine}>
                  <SkeletonBlock width={row.name[1]} height="calc(var(--text-meta-size) * 0.6)" />
                </span>
              </span>
              <span className={styles.bars} data-skeleton="">
                <span className={styles.lines}>
                  {row.bars.map((share, j) => (
                    <span key={j} className={styles.line}>
                      <span className={styles.bar} data-skeleton="" style={k(share)} />
                    </span>
                  ))}
                </span>
              </span>
              <span className={styles.delta}>
                <span className={styles.skLine}>
                  <SkeletonBlock width={row.delta[0]} height="calc(var(--text-row-title-size) * 0.7)" />
                </span>
                <span className={styles.skLine}>
                  <SkeletonBlock width={row.delta[1]} height="calc(var(--text-meta-size) * 0.6)" />
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.foot} aria-hidden="true">
        <SkeletonBlock width="13.75rem" height="calc(var(--text-meta-size) * 0.6)" />
        <SkeletonBlock width="7rem" height="calc(var(--text-meta-size) * 0.6)" />
      </div>
    </>
  )
}

export function Comparison({ props, state, error, warming, onAsk, onRetry }: PieceRenderProps<ComparisonProps>) {
  const { title, pairs, periods } = props
  const [hover, setHover] = useState<string | null>(null)
  const live = state === 'default'

  const legend = (
    <span className={styles.legend} aria-hidden="true">
      <span className={styles.legendItem} data-line="current">
        {periods.current}
      </span>
      <span className={styles.legendItem} data-line="previous">
        {periods.previous}
      </span>
    </span>
  )

  let body: ReactNode
  switch (state) {
    case 'skeleton':
      body = (
        <>
          <SkeletonBody count={pairs.length} />
          <span className="sr-only">{COMPARISON_WORDS.loading}</span>
        </>
      )
      break
    case 'empty':
      body = <StateRow kind="empty" emptyTone={props.emptyTone ?? 'neutral'} title={props.empty ?? COMPARISON_WORDS.empty} meta={props.emptyMeta} />
      break
    case 'error':
      body = (
        <StateRow
          kind="error"
          title={error?.failed ?? `Couldn't load ${title.toLowerCase()}`}
          meta={error?.cause}
          action={onRetry && <TextLink onClick={onRetry}>Try again</TextLink>}
        />
      )
      break
    case 'warming':
      body = <StateRow kind="warming" title={warming?.counting} meta={warming?.nextCheck} />
      break
    case 'default':
      body = (
        <>
          <ul className={styles.list}>
            {pairs.map(pair => (
              <PairRow
                key={pair.measure}
                pair={pair}
                periods={periods}
                hovered={hover === pair.measure}
                onHover={on => setHover(h => (on ? pair.measure : h === pair.measure ? null : h))}
                onAsk={onAsk}
              />
            ))}
          </ul>
          <div className={styles.foot}>
            <span className={styles.source}>{props.source}</span>
            <span className={styles.tally} data-tally="">
              {tally(pairs)}
            </span>
          </div>
          <table className="sr-only" data-table-view="">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">{periods.previous}</th>
                <th scope="col">{periods.current}</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(pair => {
                const suffix = pair.unit === 'percent' ? '%' : UNIT_SUFFIX[pair.unit] ? ` ${UNIT_SUFFIX[pair.unit]}` : ''
                return (
                  <tr key={pair.measure}>
                    <th scope="row">{pair.name}</th>
                    <td>{`${formatPairValue(pair.previous, pair.unit)}${suffix}`}</td>
                    <td>{`${formatPairValue(pair.current, pair.unit)}${suffix}`}</td>
                    <td>{`${deltaWords(deltaFor(pair))}, ${verdictFor(pair)}`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )
      break
  }

  return (
    <CardFrame
      as="figure"
      className={styles.card}
      title={state === 'skeleton' ? <Skeleton text="card-title" width="9rem" /> : title}
      meta={live || state === 'skeleton' ? undefined : COMPARISON_WORDS.versus(periods)}
      headerEnd={live ? legend : state === 'skeleton' ? <SkeletonBlock width="9.5rem" height="calc(var(--text-meta-size) * 0.6)" /> : undefined}
      busy={state === 'skeleton' || state === 'warming'}
      progress={state === 'warming' ? warming?.progress : undefined}
      ariaLabel={live ? comparisonLabel(props) : state === 'skeleton' ? `Loading ${title}` : undefined}
    >
      <div className={styles.body}>{body}</div>
    </CardFrame>
  )
}
