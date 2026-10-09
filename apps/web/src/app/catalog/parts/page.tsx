import { PartsGallery } from './PartsGallery'
import styles from './parts.module.css'

export const metadata = { title: 'Parts · Catalog · Generative UI for GitHub Repos' }

export default function PartsPage() {
  return (
    <article className={styles.page} aria-labelledby="parts-title">
      <header className={styles.head}>
        <h2 id="parts-title" className={styles.title}>
          Parts
        </h2>
        <p className={styles.description}>
          The pieces every component is built from. Marks and tags carry state together, never by color alone; the frame
          renders in every state; rows share one hover and one focus ring.
        </p>
      </header>
      <PartsGallery />
    </article>
  )
}
