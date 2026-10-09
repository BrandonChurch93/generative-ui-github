import type { ReactNode } from 'react'
import type { TagTone } from './tones'
import styles from './Tag.module.css'

export { TAG_TONES, type TagTone } from './tones'

/** State words on a 10% tint of their own color. The system writes the words; `quiet` is the neutral tag. */
export function Tag({ tone, children }: { tone: TagTone; children: ReactNode }) {
  return (
    <span className={styles.tag} data-tone={tone}>
      {children}
    </span>
  )
}
