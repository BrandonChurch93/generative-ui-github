import { cx } from './cx'
import styles from './Mark.module.css'

export const MARK_KINDS = ['good', 'warn', 'crit', 'neutral', 'unavailable', 'warming', 'node', 'endpoint'] as const
export type MarkKind = (typeof MARK_KINDS)[number]

/** A state mark. Decorative: the words beside it always carry the state. */
export function Mark({ kind, className }: { kind: MarkKind; className?: string }) {
  return <span className={cx(styles.mark, className)} data-kind={kind} data-mark="" aria-hidden="true" />
}
