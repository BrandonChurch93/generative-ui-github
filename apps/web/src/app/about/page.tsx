import { Frame } from '../../shell/Frame'
import styles from '../placeholder.module.css'

export const metadata = { title: 'About · Generative UI for GitHub Repos' }

// Phase 10 writes the full page (screens/About.html).
export default function AboutPage() {
  return (
    <Frame current="about">
      <section className={styles.intro}>
        <h1 className={styles.title}>Generative UI for GitHub Repos</h1>
        <p className={styles.lead}>Paste a public repo, ask it a question, and an agent composes an interface around that repo&apos;s data from a hand-built component catalog. The model decides; the code renders.</p>
      </section>
    </Frame>
  )
}
