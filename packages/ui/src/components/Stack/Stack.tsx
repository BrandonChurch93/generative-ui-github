import type { ReactNode } from 'react'
import styles from './Stack.module.css'

export type StackGap = 'region' | 'card' | 'row'

export function Stack({ gap = 'region', children }: { gap?: StackGap; children?: ReactNode }) {
  return (
    <div className={styles.stack} data-gap={gap} data-piece="Stack">
      {children}
    </div>
  )
}
