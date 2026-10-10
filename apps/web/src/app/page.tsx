import { connection } from 'next/server'
import { loadConfig, logger } from '@genui-github/core'
import { goldenComposition, TEMPLATE_NEEDS } from '@genui-github/composer'
import type { RepoShape } from '@genui-github/data'
import { cacheKey, canonicalSample, isSample, readSample, type RepoRef } from '@genui-github/data/server'
import { configErrorCopy } from '../lib/config-state'
import { Landing, type LandingPreview } from '../landing/Landing'
import { GROUPS, PREVIEW, SAMPLE_NAMES, type QuestionGroup } from '../landing/questions'
import { parseRepo } from '../landing/repoInput'
import { avatarUrl, type SampleRepo } from '../landing/samples'
import { Frame } from '../shell/Frame'
import { day } from '../shell/words'
import styles from './page.module.css'

const log = logger.child('web:home')

const refOf = (repo: string) => {
  const parsed = parseRepo(repo)
  return parsed.ok ? { owner: parsed.owner, name: parsed.name } : undefined
}

const groups: QuestionGroup[] = GROUPS.map(g => ({ label: g.label, draws: g.draws, questions: g.templates.map(id => TEMPLATE_NEEDS[id].question) }))
const sampleNames = SAMPLE_NAMES.filter(name => {
  const ref = refOf(name)
  return ref !== undefined && isSample(ref)
})

// A sample file is megabytes, so each is read once per server instance for the little the landing shows of it.
const read = new Map<string, { refreshedAt?: string; shape?: RepoShape }>()
function sampleFacts(ref: RepoRef) {
  const key = `${ref.owner}/${ref.name}`.toLowerCase()
  let facts = read.get(key)
  if (facts) return facts
  try {
    const file = readSample(ref)
    const shape = file.entries[cacheKey.shape(canonicalSample(ref), 'repo')]?.value as RepoShape | undefined
    facts = { refreshedAt: file.refreshedAt, shape }
  } catch (error) {
    log.warn('sample file unreadable', { repo: key, error: error instanceof Error ? error.message : String(error) })
    facts = {}
  }
  read.set(key, facts)
  return facts
}

let samples: SampleRepo[] | undefined
function samplesOnce(): SampleRepo[] {
  samples ??= sampleNames.map(name => {
    const ref = refOf(name)!
    const { shape } = sampleFacts(ref)
    return {
      name,
      avatar: avatarUrl(shape?.owner ?? ref.owner),
      ...(shape?.description ? { description: shape.description } : {}),
      ...(shape ? { stars: shape.stars } : {}),
    }
  })
  return samples
}

let preview: LandingPreview | null | undefined
function previewOnce(): LandingPreview | null {
  if (preview !== undefined) return preview
  const ref = refOf(PREVIEW.repo)!
  const question = TEMPLATE_NEEDS[PREVIEW.template].question
  const composition = goldenComposition(ref, question)
  const { refreshedAt } = sampleFacts(ref)
  const sampleDay = refreshedAt ? day(refreshedAt) : undefined
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

  return <Landing samples={samplesOnce()} groups={groups} preview={previewOnce()} />
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
