import type { CSSProperties } from 'react'
import { CardFrame, Mark, Skeleton, TextLink } from '../../parts'
import { formatCount } from '../../motion/primitives'
import type { PieceRenderProps } from '../../types'
import { Sparkline } from '../Sparkline/Sparkline'
import type { MetricProps } from './schema'
import styles from './Metric.module.css'

export function formatMetricValue(value: number | string): string {
  return typeof value === 'number' ? formatCount(value, Number.isInteger(value) ? 0 : 1) : value
}

export function Metric({ props, state, error, warming, ask, onAsk, onRetry }: PieceRenderProps<MetricProps>) {
  const { label, value, suffix, delta, deltaTone, hot, series, message, windowWords, format } = props
  const live = state === 'default'

  const slot = () => {
    switch (state) {
      case 'default':
        return (
          <span className={styles.value}>
            <span data-number="" data-format={format}>
              {formatMetricValue(value)}
            </span>
            {suffix && (
              <small className={styles.suffix} data-suffix="">
                {suffix}
              </small>
            )}
            {series && <Sparkline points={series.points} finding={series.finding} className={styles.trend} />}
          </span>
        )
      case 'skeleton':
        return (
          <span className={styles.value}>
            <Skeleton text="metric" size="var(--metric-size)" width="40%" />
            <span className="sr-only">Loading {label}.</span>
          </span>
        )
      case 'empty':
        return (
          <span className={styles.message} data-quiet="">
            <Mark kind="neutral" />
            {message ?? 'Nothing yet'}
          </span>
        )
      case 'error':
        return (
          <span className={styles.message}>
            <Mark kind="unavailable" />
            {error?.failed ?? "Couldn't load"}
          </span>
        )
      case 'warming':
        return (
          <span className={styles.message} data-quiet="">
            <Mark kind="warming" />
            {warming?.counting ?? 'GitHub is counting'}
          </span>
        )
    }
  }

  const deltaRow = () => {
    if (state === 'skeleton') return <Skeleton text="meta" width="55%" />
    if (state === 'empty') return <span>{windowWords ? `window · ${windowWords}` : ' '}</span>
    if (state === 'error')
      return (
        <>
          <span>{error?.cause}</span>
          {onRetry && (
            <TextLink size="hint" onClick={onRetry}>
              Try again
            </TextLink>
          )}
        </>
      )
    if (state === 'warming') return <span>{warming?.nextCheck}</span>
    return <span data-delta="">{delta ?? windowWords ?? ' '}</span>
  }

  const interactive = live && ask !== undefined && onAsk !== undefined
  return (
    <CardFrame
      as="div"
      className={styles.card}
      hot={live && hot}
      busy={state === 'skeleton' || state === 'warming'}
      onClick={interactive ? () => onAsk(ask) : undefined}
    >
      {live && hot && (
        <>
          <span className="sr-only">Blocking.</span>
          <span className={styles.hotMark}><Mark kind="crit" /></span>
        </>
      )}
      <span className={styles.label}>{state === 'skeleton' ? <Skeleton text="label" width="60%" /> : label}</span>
      {slot()}
      <span className={styles.delta} data-tone={live ? deltaTone : undefined}>
        {deltaRow()}
      </span>
      {live && <span className={styles.bar} data-bar="" aria-hidden="true" />}
      {state === 'warming' && (
        <span className={styles.track} aria-hidden="true">
          <span
            className={styles.bar}
            data-bar=""
            style={{ '--progress': Math.min(1, Math.max(0, warming?.progress ?? 0)) } as CSSProperties}
          />
        </span>
      )}
    </CardFrame>
  )
}
