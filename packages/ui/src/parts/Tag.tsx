import type { ReactNode } from 'react'
import styles from './Tag.module.css'

export const TAG_TONES = ['good', 'warn', 'crit', 'quiet'] as const
export type TagTone = (typeof TAG_TONES)[number]

/** State words on a 10% tint of their own color. The system writes the words; `quiet` is the neutral tag. */
export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return (
    <span className={styles.tag} data-tone={tone}>
      {children}
    </span>
  )
}
