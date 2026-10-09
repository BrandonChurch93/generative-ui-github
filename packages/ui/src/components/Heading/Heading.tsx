import type { ReactNode } from 'react'
import styles from './Heading.module.css'

export type HeadingStyle = 'question' | 'section' | 'card-title'

export function Heading({ level = 2, look = 'section', children }: { level?: 1 | 2 | 3; look?: HeadingStyle; children: ReactNode }) {
  const Tag = `h${level}` as const
  return (
    <Tag className={styles.heading} data-look={look} data-piece="Heading">
      {children}
    </Tag>
  )
}
