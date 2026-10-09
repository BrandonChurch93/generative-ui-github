'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'
import { RepoChip, type PieceRenderProps } from '@genui-github/ui'
import { PIECES } from '@genui-github/ui/pieces'
import type { TextInput } from '@genui-github/ui/schemas'
import { Frame } from '../shell/Frame'
import { lastRepo, onLastRepoChange } from '../shell/lastRepo'
import { HowItWorks } from './HowItWorks'
import styles from './Landing.module.css'
import { Preview, type LandingPreview } from './Preview'
import type { QuestionGroup } from './questions'
import { parseRepo, repoPath } from './repoInput'

export type { LandingPreview }

type HeroProps = TextInput.TextInputProps
const Field = PIECES.TextInput!.Component as ComponentType<PieceRenderProps<HeroProps>>

/** The hero's words, all the system's. */
const HERO = {
  placeholder: 'Paste a public GitHub repo',
  helper: 'Public repos only, as owner/name or a github.com link',
} as const

/**
 * The landing (`screens/Landing.html`): the sentence, the hero field, the sample repos, a composed answer in
 * miniature, and the twelve questions. The hero field is the ask, so there is no tray.
 */
export function Landing({ samples, initialRepo, groups, preview }: { samples: string[]; initialRepo: string; groups: QuestionGroup[]; preview: LandingPreview | null }) {
  const router = useRouter()
  const [repo, setRepo] = useState(initialRepo)
  const [status, setStatus] = useState<TextInput.FieldStatus>()
  const [how, setHow] = useState(false)
  const howButton = useRef<HTMLButtonElement>(null)
  // Read after hydration: the server never knows it, so the first paint matches and the slot is reserved.
  const last = useSyncExternalStore(onLastRepoChange, lastRepo, () => undefined)
  const samplesLabel = useId()
  const questionsLabel = useId()

  const open = (value: string) => {
    const parsed = parseRepo(value)
    if (!parsed.ok) {
      setStatus({ kind: 'invalid', problem: parsed.problem })
      return
    }
    router.push(repoPath(`${parsed.owner}/${parsed.name}`))
  }

  const howLink = (
    <button ref={howButton} type="button" className={styles.how} onClick={() => setHow(true)} aria-haspopup="dialog" aria-expanded={how} data-how="">
      How this works
    </button>
  )

  return (
    <>
      <Frame inert={how}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            <span>Paste a GitHub repo, ask a question,</span> and an agent composes the interface that answers it.
          </h1>
          <div className={styles.start}>
            <div className={styles.lead}>
              <Field
                state="default"
                props={{
                  label: 'Public GitHub repository',
                  kind: 'identifier',
                  validate: 'repo',
                  size: 'hero',
                  placeholder: HERO.placeholder,
                  helper: HERO.helper,
                  status,
                  onSubmit: open,
                }}
              />
              <div className={styles.samples}>
                <p className={styles.samplesLabel} id={samplesLabel}>
                  Or try a sample
                </p>
                <div className={styles.chips} role="group" aria-labelledby={samplesLabel}>
                  {samples.map(name => (
                    <button key={name} type="button" className={styles.sample} aria-pressed={name === repo} onClick={() => setRepo(name)} data-sample="">
                      <RepoChip repo={name} selected={name === repo} className={styles.sampleChip} />
                    </button>
                  ))}
                </div>
                <div className={styles.offer}>
                  {last && (
                    <Link className={styles.offerLink} href={repoPath(last)} prefetch={false} data-offer="">
                      <span>Pick up where you left off</span>
                      <RepoChip repo={last} className={styles.offerChip} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
            {preview ? <Preview preview={preview} action={howLink} /> : <p className={styles.cap}>{howLink}</p>}
          </div>
        </div>

        <section className={styles.questions} aria-labelledby={questionsLabel}>
          <div className={styles.questionsHead}>
            <h2 id={questionsLabel}>Questions to try</h2>
            <p>
              Each kind of question composes a different screen for <code>{repo}</code>.
            </p>
          </div>
          <ul className={styles.groups}>
            {groups.map(group => (
              <li key={group.label} className={styles.group} data-group={group.label}>
                <div>
                  <h3>{group.label}</h3>
                  <p>{group.draws}</p>
                </div>
                <div className={styles.qchips}>
                  {group.questions.map(question => (
                    <Link key={question} className={styles.qchip} href={repoPath(repo, question)} prefetch={false} data-question="">
                      {question}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Frame>
      <HowItWorks open={how} onClose={() => setHow(false)} opener={howButton} />
    </>
  )
}
