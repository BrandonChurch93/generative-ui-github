import type { ReactNode } from 'react'
import styles from './Surface.module.css'

export function Surface({ tint, children }: { tint?: boolean; children?: ReactNode }) {
  return (
    <div className={styles.surface} data-tint={tint || undefined} data-piece="Surface">
      {children}
    </div>
  )
}
