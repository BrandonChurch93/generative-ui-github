import type { CSSProperties } from 'react'
import { CardFrame, Mark, Skeleton, TextLink } from '../../parts'
import { formatCount } from '../../motion/primitives'
import type { PieceRenderProps } from '../../types'
import { PROGRESS_EMPTY, SHARE_WORDS, type ProgressProps } from './schema'
import styles from './Progress.module.css'

/** The part over the whole, 0 to 1. A part larger than its whole still draws a full track, never past it. */
export const shareOf = (count: number, total: number) => (total > 0 ? Math.min(1, Math.max(0, count / total)) : 0)

/** Whole percents; a sliver that would round to nothing says so rather than claiming zero. */
export function formatShare(percent: number): string {
  return percent > 0 && percent < 1 ? '<1' : formatCount(percent, 0)
}

export function Progress({ props, state, error, warming, ask, onAsk, onRetry }: PieceRenderProps<ProgressProps>) {
  const { measure, label, count, total, meta, message } = props
  const isEmpty = state === 'empty' || (state === 'default' && total <= 0)
  const live = state === 'default' && !isEmpty
  const share = shareOf(count, total)
  const word = SHARE_WORDS[measure]

  const slot = () => {
    if (live) {
      return (
        <span className={styles.value}>
          <span data-number="">{formatCount(count, 0)}</span>
          <small className={styles.suffix} data-suffix="">
            of {formatCount(total, 0)}
          </small>
        </span>
      )
    }
    switch (state) {
      case 'skeleton':
        return (
          <span className={styles.value}>
            <Skeleton text="metric" size="var(--metric-size)" width="55%" />
            <span className="sr-only">Loading {label}.</span>
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
        // Omitted in the spec; drawn anyway so a stray warming state never leaves a blank card.
        return (
          <span className={styles.message} data-quiet="">
            <Mark kind="warming" />
            {warming?.counting ?? 'GitHub is counting'}
          </span>
        )
      default:
        return (
          <span className={styles.message} data-quiet="">
            <Mark kind="neutral" />
            {message ?? PROGRESS_EMPTY}
          </span>
        )
    }
  }

  const metaRow = () => {
    if (state === 'skeleton') return <Skeleton text="meta" width="45%" />
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
    if (!live) return <span>{meta ?? ' '}</span>
    return (
      <span>
        <span data-share="">{formatShare(share * 100)}</span>%{word ? ` ${word}` : ''}
        {meta ? ` · ${meta}` : ''}
      </span>
    )
  }

  const interactive = live && ask !== undefined && onAsk !== undefined
  return (
    <CardFrame
      as="div"
      className={styles.card}
      busy={state === 'skeleton' || state === 'warming'}
      onClick={interactive ? () => onAsk(ask) : undefined}
    >
      <span className={styles.label}>{state === 'skeleton' ? <Skeleton text="label" width="60%" /> : label}</span>
      {slot()}
      <span className={styles.meta}>{metaRow()}</span>
      {(live || state === 'warming') && (
        <span className={styles.track} aria-hidden="true">
          <span
            className={styles.fill}
            data-fill=""
            style={{ '--share': live ? share : Math.min(1, Math.max(0, warming?.progress ?? 0)) } as CSSProperties}
          />
        </span>
      )}
    </CardFrame>
  )
}
