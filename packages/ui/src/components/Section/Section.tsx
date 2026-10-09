import { useId, type ReactNode } from 'react'
import styles from './Section.module.css'

export function Section({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id} data-piece="Section">
      <header className={styles.head}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {meta && <span className={styles.meta}>{meta}</span>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
