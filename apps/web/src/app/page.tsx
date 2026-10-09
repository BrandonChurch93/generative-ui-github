import { connection } from 'next/server'
import { loadConfig, logger } from '@genui-github/core'
import { goldenComposition, TEMPLATE_NEEDS } from '@genui-github/composer'
import { isSample, readSample } from '@genui-github/data/server'
import { configErrorCopy } from '../lib/config-state'
import { Landing, type LandingPreview } from '../landing/Landing'
import { GROUPS, PREVIEW, SAMPLE_NAMES, type QuestionGroup } from '../landing/questions'
import { parseRepo } from '../landing/repoInput'
import { Frame } from '../shell/Frame'
import { day } from '../shell/words'
import styles from './page.module.css'

const log = logger.child('web:home')

const refOf = (repo: string) => {
  const parsed = parseRepo(repo)
  return parsed.ok ? { owner: parsed.owner, name: parsed.name } : undefined
}

const groups: QuestionGroup[] = GROUPS.map(g => ({ label: g.label, draws: g.draws, questions: g.templates.map(id => TEMPLATE_NEEDS[id].question) }))
const samples = SAMPLE_NAMES.filter(name => {
  const ref = refOf(name)
  return ref !== undefined && isSample(ref)
})

// The preview's composition and its sample's date are read once per server instance; a sample file is megabytes.
let preview: LandingPreview | null | undefined
function previewOnce(): LandingPreview | null {
  if (preview !== undefined) return preview
  const ref = refOf(PREVIEW.repo)!
  const question = TEMPLATE_NEEDS[PREVIEW.template].question
  const composition = goldenComposition(ref, question)
  let sampleDay: string | undefined
  try {
    sampleDay = day(readSample(ref).refreshedAt)
  } catch {
    sampleDay = undefined
  }
  if (!composition) log.warn('landing preview missing', { repo: PREVIEW.repo, template: PREVIEW.template })
  preview = composition ? { repo: PREVIEW.repo, question, composition, sampleDay } : null
  return preview
}

export default async function Home() {
  // Read the environment per request, never at build time, so a missing token shows here instead of baking into the page.
  await connection()
  const config = loadConfig()

  if (!config.ok) {
    return (
      <Frame>
        <div className={styles.page}>
          <h1 className={styles.title}>Generative UI for GitHub Repos</h1>
          <ConfigError problems={config.problems} />
        </div>
      </Frame>
    )
  }

  return <Landing samples={samples} initialRepo={PREVIEW.repo} groups={groups} preview={previewOnce()} />
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
