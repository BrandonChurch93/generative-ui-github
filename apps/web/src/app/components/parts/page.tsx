import { Foundations } from '../_gallery/Foundations'
import { PartsGallery } from './PartsGallery'
import styles from './parts.module.css'

export const metadata = { title: 'Parts · Components · Generative UI for GitHub Repos' }

export default function PartsPage() {
  return (
    <article className={styles.page} aria-labelledby="parts-title">
      <Foundations current="/components/parts" />
      <header className={styles.head}>
        <h1 id="parts-title" className={styles.title}>
          Parts
        </h1>
        <p className={styles.description}>
          The pieces every component is built from. Marks and tags carry state together, never by color alone; the frame
          renders in every state; rows share one hover and one focus ring.
        </p>
      </header>
      <PartsGallery />
    </article>
  )
}
