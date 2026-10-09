import { Frame } from '../../shell/Frame'
import styles from '../placeholder.module.css'

export const metadata = { title: 'Evals · Generative UI for GitHub Repos' }

// Phase 7 replaces this with the results page (screens/Evals.html); until the first full run there is nothing to show.
export default function EvalsPage() {
  return (
    <Frame current="evals">
      <section className={styles.intro}>
        <h1 className={styles.title}>How well the composer answers</h1>
        <p className={styles.lead}>The eval results appear here after the first full run of the 99 cases.</p>
      </section>
    </Frame>
  )
}
