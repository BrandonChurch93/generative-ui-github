import type { CSSProperties, ReactNode } from 'react'
import styles from './Grid.module.css'

/** Equal columns; four steps to two under 1024px and to one under 640px, like the metric row. */
export function Grid({ columns = 2, children }: { columns?: 1 | 2 | 3 | 4; children?: ReactNode }) {
  return (
    <div className={styles.grid} style={{ '--columns': columns } as CSSProperties} data-columns={columns} data-piece="Grid">
      {children}
    </div>
  )
}
