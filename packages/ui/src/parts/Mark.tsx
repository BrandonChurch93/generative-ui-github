import styles from './Mark.module.css'

export const MARK_KINDS = ['good', 'warn', 'crit', 'neutral', 'unavailable', 'warming', 'node', 'endpoint'] as const
export type MarkKind = (typeof MARK_KINDS)[number]

/** A state mark. Decorative: the words beside it always carry the state. A host places it inside its own slot. */
export function Mark({ kind }: { kind: MarkKind }) {
  return <span className={styles.mark} data-kind={kind} data-mark="" aria-hidden="true" />
}
