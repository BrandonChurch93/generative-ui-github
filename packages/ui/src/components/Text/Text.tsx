import type { ReactNode } from 'react'
import styles from './Text.module.css'

export type TextLook = 'body' | 'lead' | 'hint' | 'meta'

export function Text({ look = 'body', children }: { look?: TextLook; children: ReactNode }) {
  return (
    <p className={styles.text} data-look={look} data-piece="Text">
      {children}
    </p>
  )
}
