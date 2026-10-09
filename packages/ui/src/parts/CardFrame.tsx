import { useId, type CSSProperties, type ReactNode } from 'react'
import { cx } from './cx'
import styles from './CardFrame.module.css'

export interface CardFrameProps {
  title?: ReactNode
  meta?: ReactNode
  /** The header's trailing slot: the table view control, a Source link. */
  headerEnd?: ReactNode
  headingLevel?: 2 | 3
  as?: 'section' | 'article' | 'figure' | 'div'
  /** A card that asks a follow-up question is itself the button, so its focus ring is never clipped. */
  onClick?: () => void
  /** The model flagged this card as blocking. The host adds the crit mark and the hidden words. */
  hot?: boolean
  /** Warming progress, 0 to 1. Draws the 3px bar along the bottom edge. */
  progress?: number
  busy?: boolean
  ariaLabel?: string
  className?: string
  children?: ReactNode
}

/** The frame every card shares. It renders in every state so the reader knows what is loading, missing or failed. */
export function CardFrame({
  title,
  meta,
  headerEnd,
  headingLevel = 2,
  as: Tag = 'section',
  onClick,
  hot,
  progress,
  busy,
  ariaLabel,
  className,
  children,
}: CardFrameProps) {
  const titleId = useId()
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const hasHeader = title !== undefined || meta !== undefined || headerEnd !== undefined
  const Root = onClick ? 'button' : Tag
  return (
    <Root
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx(styles.card, className)}
      data-hot={hot ? '' : undefined}
      data-card=""
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && title !== undefined ? titleId : undefined}
    >
      {hasHeader && (
        <header className={styles.head} data-card-head="">
          <div className={styles.titles}>
            {title !== undefined && (
              <Heading id={titleId} className={styles.title}>
                {title}
              </Heading>
            )}
            {meta !== undefined && <span className={styles.meta}>{meta}</span>}
          </div>
          {headerEnd !== undefined && <div className={styles.end}>{headerEnd}</div>}
        </header>
      )}
      {children}
      {progress !== undefined && (
        <span
          className={styles.progress}
          style={{ '--progress': Math.min(1, Math.max(0, progress)) } as CSSProperties}
          data-progress=""
          aria-hidden="true"
        >
          <span className={styles.fill} />
        </span>
      )}
    </Root>
  )
}
