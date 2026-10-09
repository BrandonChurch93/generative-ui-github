import { MotionBench } from './MotionBench'
import styles from './motion.module.css'

export const metadata = { title: 'Motion · Catalog · Generative UI for GitHub Repos' }

export default function MotionPage() {
  return (
    <article className={styles.page} aria-labelledby="motion-title">
      <header className={styles.head}>
        <h2 id="motion-title" className={styles.title}>
          Motion
        </h2>
        <p className={styles.description}>
          Six moves and the card rise. GSAP runs what draws, counts, extends or wipes inside a piece; Motion owns the
          card around it. Reduced motion collapses every move to a 200ms opacity change.
        </p>
      </header>
      <MotionBench />
    </article>
  )
}
