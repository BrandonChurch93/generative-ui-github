import type { CSSProperties } from 'react'
import { cx } from './cx'
import styles from './Skeleton.module.css'

export type SkeletonText =
  | 'question'
  | 'metric'
  | 'insight'
  | 'body'
  | 'row-title'
  | 'card-title'
  | 'label'
  | 'action'
  | 'value'
  | 'hint'
  | 'section'
  | 'lead'
  | 'meta'
  | 'tag'
  | 'axis'
  | 'code'
  | 'handle'

/** A placeholder at a type style's real line height, so nothing jumps when the words land. */
export function Skeleton({
  text = 'body',
  width = '100%',
  size,
  className,
}: {
  text?: SkeletonText
  width?: string
  /** A density variable that overrides the style's fixed size, such as `var(--metric-size)`. */
  size?: string
  className?: string
}) {
  const style = {
    '--sk-size': size ?? `var(--text-${text}-size)`,
    '--sk-leading': `var(--text-${text}-leading)`,
    '--sk-w': width,
  } as CSSProperties
  return (
    <span className={cx(styles.line, className)} style={style} data-skeleton="" aria-hidden="true">
      <span className={styles.block} />
    </span>
  )
}

/** A placeholder for a shape that is not text: a bar, a disc, a plot. */
export function SkeletonBlock({
  width,
  height,
  round,
  className,
}: {
  width: string
  height: string
  round?: boolean
  className?: string
}) {
  const style = { '--sk-w': width, '--sk-h': height } as CSSProperties
  return (
    <span
      className={cx(styles.shape, className)}
      style={style}
      data-round={round ? '' : undefined}
      data-skeleton=""
      aria-hidden="true"
    />
  )
}
