import type { ReactNode } from 'react'
import styles from './SplitView.module.css'

/** The main and side columns. `level` evens the bottoms when both columns are cards of one height class. */
export function SplitView({ main, side, level }: { main: ReactNode; side?: ReactNode; level?: boolean }) {
  return (
    <div className={styles.split} data-level={level || undefined} data-piece="SplitView">
      <div className={styles.column}>{main}</div>
      {side && <div className={styles.column}>{side}</div>}
    </div>
  )
}
