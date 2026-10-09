import type { CSSProperties } from 'react'
import { Mark } from '../../parts'
import { cx } from '../../parts/cx'
import { sparkGeometry } from './geometry'
import styles from './Sparkline.module.css'

export interface SparklineProps {
  /** Twelve weekly values, oldest first; the last is the value shown beside it. */
  points?: readonly number[]
  /** The trend in words, for the aria-label. */
  finding?: string
  state?: 'default' | 'skeleton' | 'empty' | 'error' | 'warming'
  /** Warming progress, 0 to 1. */
  progress?: number
  /** `metric` sits on the number's baseline and drops under 56px; `row` is the fixed 80px list slot. */
  placement?: 'metric' | 'row'
  className?: string
}

/** The inline trend beside a number. A part of Metric and list rows, never picked on its own. */
export function Sparkline({ points = [], finding, state = 'default', progress = 0, placement = 'metric', className }: SparklineProps) {
  const geometry = state === 'default' ? sparkGeometry(points) : null
  return (
    <span className={cx(styles.slot, className)} data-placement={placement} data-spark="" data-state={state}>
      {state === 'skeleton' && <span className={styles.skeleton} aria-hidden="true" />}
      {(state === 'empty' || (state === 'default' && !geometry)) && <span className={styles.baseline} aria-hidden="true" />}
      {state === 'warming' && (
        <span className={styles.baseline} aria-hidden="true">
          <span className={styles.fill} style={{ '--progress': Math.min(1, Math.max(0, progress)) } as CSSProperties} />
        </span>
      )}
      {state === 'error' && (
        <span className={styles.center}>
          <Mark kind="unavailable" />
          <span className="sr-only">Trend unavailable.</span>
        </span>
      )}
      {geometry && (
        <span className={styles.box} role="img" aria-label={finding}>
          <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.line} d={geometry.line} data-spark-line="" />
            <path className={styles.latest} d={geometry.latest} data-spark-latest="" />
          </svg>
          <span
            className={styles.end}
            style={{ '--end-y': `${geometry.end.y}%` } as CSSProperties}
            data-spark-end=""
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  )
}
