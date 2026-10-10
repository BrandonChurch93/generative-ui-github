import { Foundations } from '../_gallery/Foundations'
import { DensityColumn } from './DensityColumn'
import styles from './density.module.css'

export const metadata = { title: 'Density · Components · Generative UI for GitHub Repos' }

export default function DensityPage() {
  return (
    <article className={styles.page} aria-labelledby="density-title">
      <Foundations current="/components/density" />
      <header className={styles.head}>
        <h1 id="density-title" className={styles.title}>
          Density
        </h1>
        <p className={styles.description}>
          Set once on the screen root as <code>data-density</code>; every card and row reads the same variables. Spacious
          steps down to comfortable under 640px.
        </p>
      </header>
      <div className={styles.columns}>
        <DensityColumn density="compact" />
        <DensityColumn density="comfortable" />
        <DensityColumn density="spacious" />
      </div>
    </article>
  )
}
