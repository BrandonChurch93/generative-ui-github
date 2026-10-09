import { connection } from 'next/server'
import { loadConfig, logger } from '@genui-github/core'
import { configErrorCopy } from '../lib/config-state'
import styles from './page.module.css'

const log = logger.child('web:home')

export default async function Home() {
  // Read the environment per request, never at build time, so a missing token shows here instead of baking into the page.
  await connection()
  const config = loadConfig()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Generative UI for GitHub Repos</h1>
      {config.ok ? (
        <p className={styles.lead}>Paste a public repo, ask it a question, and the screen composes itself around the answer.</p>
      ) : (
        <ConfigError problems={config.problems} />
      )}
    </main>
  )
}

function ConfigError({ problems }: { problems: Parameters<typeof configErrorCopy>[0] }) {
  const copy = configErrorCopy(problems)
  log.error('config incomplete', { variables: copy.variables })
  return (
    <section className={styles.card} aria-labelledby="config-error-label" data-state="error" data-testid="config-error">
      <header className={styles.cardHeader}>
        <h2 id="config-error-label" className={styles.cardTitle}>
          {copy.label}
        </h2>
      </header>
      <div className={styles.cardBody}>
        <p className={styles.failed}>{copy.failed}</p>
        <p className={styles.meta}>{copy.cause}</p>
        <p className={styles.meta}>{copy.fix}</p>
      </div>
    </section>
  )
}
