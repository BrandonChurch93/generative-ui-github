import type { ReactNode } from 'react'
import type { EmptyTone } from '../types'
import { Mark, type MarkKind } from './Mark'
import styles from './StateRow.module.css'

export type StateRowProps =
  | { kind: 'empty'; emptyTone?: EmptyTone; title: ReactNode; meta?: ReactNode; action?: never }
  | { kind: 'error'; title: ReactNode; meta?: ReactNode; action?: ReactNode; emptyTone?: never }
  | { kind: 'warming'; title: ReactNode; meta?: ReactNode; action?: never; emptyTone?: never }

/**
 * The one row a list-shaped card shows when it has no rows: empty, error or warming.
 * Error is never crit: the unavailable mark, what failed in ink, the cause in meta.
 */
export function StateRow({ kind, emptyTone = 'neutral', title, meta, action }: StateRowProps) {
  const mark: MarkKind = kind === 'error' ? 'unavailable' : kind === 'warming' ? 'warming' : emptyTone
  return (
    <div className={styles.row} data-state={kind} data-state-row="">
      <Mark kind={mark} className={styles.mark} />
      <div className={styles.text}>
        <div className={styles.titleLine}>
          <span className={styles.title}>{title}</span>
          {action}
        </div>
        {meta !== undefined && <span className={styles.meta}>{meta}</span>}
      </div>
    </div>
  )
}
