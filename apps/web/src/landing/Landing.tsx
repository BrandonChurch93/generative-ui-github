'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type FormEvent, type MouseEvent } from 'react'
import { RepoChip, TextInput as TextInputPiece, type PieceRenderProps } from '@genui-github/ui'
import { prefersReducedMotion, wipe } from '@genui-github/ui/motion'
import type { TextInput } from '@genui-github/ui/schemas'
import { Frame } from '../shell/Frame'
import { lastRepo, onLastRepoChange } from '../shell/lastRepo'
import { HOW_ID, HowItWorks } from './HowItWorks'
import styles from './Landing.module.css'
import type { LandingPreview } from './Preview'
import type { QuestionGroup } from './questions'
import { parseRepo, repoPath } from './repoInput'

export type { LandingPreview }

type HeroProps = TextInput.TextInputProps
const Field = TextInputPiece as unknown as ComponentType<PieceRenderProps<HeroProps>>

/** The landing's words, all the system's. */
const WORDS = {
  placeholder: 'Paste a public GitHub repo',
  helper: 'Public repos only, as owner/name or a github.com link',
  samples: 'Or try a sample GitHub repo',
  waiting: 'Pick a repo first. Then type a question or choose one of twelve.',
  ask: 'Type your own question',
  or: 'or pick one',
} as const

/** A typed repo un-mutes step 2 once the typing pauses, so it does not wipe in halfway through a name. */
const SETTLE_MS = 400

/** Step 2 counts as below the fold once its top is past this share of the viewport: its field would be out of sight. */
const FOLD = 2 / 3

/** The route's limit on a question, which the tray keeps too. */
const QUESTION_MAX = 300

/**
 * The landing: the sentence, then the journey in two numbered steps (pick a repo, ask it a question), then how it
 * works. Step 2 waits in `muted` until a repo is chosen, then turns to ink and its content wipes in. The hero field
 * is the ask, so there is no tray.
 */
export function Landing({ samples, groups, preview }: { samples: string[]; groups: QuestionGroup[]; preview: LandingPreview | null }) {
  const router = useRouter()
  const [repo, setRepo] = useState<string>()
  const [status, setStatus] = useState<TextInput.FieldStatus>()
  // Read after hydration: the server never knows it, so the first paint matches and the slot is reserved.
  const last = useSyncExternalStore(onLastRepoChange, lastRepo, () => undefined)
  const askStep = useRef<HTMLElement>(null)
  const typing = useRef<number | undefined>(undefined)
  const pickTitle = useId()
  const askTitle = useId()
  const samplesLabel = useId()

  const open = (value: string) => {
    const parsed = parseRepo(value)
    if (!parsed.ok) {
      setStatus({ kind: 'invalid', problem: parsed.problem })
      return
    }
    router.push(repoPath(`${parsed.owner}/${parsed.name}`))
  }

  // The hero field keeps its own value; its input events bubble here, so a repo that parses can be chosen.
  const typed = (event: FormEvent<HTMLDivElement>) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    window.clearTimeout(typing.current)
    const parsed = parseRepo(input.value)
    if (!parsed.ok) return
    typing.current = window.setTimeout(() => setRepo(`${parsed.owner}/${parsed.name}`), SETTLE_MS)
  }
  useEffect(() => () => window.clearTimeout(typing.current), [])

  const pick = (name: string) => {
    window.clearTimeout(typing.current)
    setRepo(name)
    // A click commits before the next frame, so step 2 has its content by then. Low on the screen, it comes up.
    requestAnimationFrame(() => {
      const step = askStep.current
      if (!step || step.getBoundingClientRect().top < window.innerHeight * FOLD) return
      step.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const toHow = (event: MouseEvent<HTMLAnchorElement>) => {
    const section = document.getElementById(HOW_ID)
    if (!section) return
    event.preventDefault()
    section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
    window.history.replaceState(null, '', `#${HOW_ID}`)
  }

  return (
    <Frame>
      <div className={styles.hero}>
        <h1 className={styles.title}>
          <span>Paste a GitHub repo, ask a question,</span> and an agent composes the interface that answers it.
        </h1>
        <p className={styles.howLine}>
          <a className={styles.howLink} href={`#${HOW_ID}`} onClick={toHow} data-how="">
            How it works
          </a>
        </p>
      </div>

      <div className={styles.journey}>
        <section className={styles.step} aria-labelledby={pickTitle} data-step="1">
          <h2 className={styles.stepTitle} id={pickTitle}>
            <span className={styles.stepNum}>1</span> · Pick a repo
          </h2>
          <div className={styles.pick}>
            <div className={styles.paste} onInput={typed}>
              <Field
                state="default"
                props={{
                  label: 'Public GitHub repository',
                  kind: 'identifier',
                  validate: 'repo',
                  size: 'hero',
                  placeholder: WORDS.placeholder,
                  helper: WORDS.helper,
                  status,
                  onSubmit: open,
                }}
              />
              <div className={styles.offer}>
                {last && (
                  <Link className={styles.offerLink} href={repoPath(last)} prefetch={false} data-offer="">
                    <span>Pick up where you left off</span>
                    <RepoChip repo={last} className={styles.offerChip} />
                  </Link>
                )}
              </div>
            </div>
            <div className={styles.samples}>
              <p className={styles.eyebrow} id={samplesLabel}>
                {WORDS.samples}
              </p>
              <div className={styles.chips} role="group" aria-labelledby={samplesLabel}>
                {samples.map(name => (
                  <button key={name} type="button" className={styles.sample} aria-pressed={name === repo} onClick={() => pick(name)} data-sample="">
                    <RepoChip repo={name} selected={name === repo} className={styles.sampleChip} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className={styles.join} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v10" />
            <path d="M4 9l4 4 4-4" />
          </svg>
        </div>

        <section ref={askStep} className={styles.step} aria-labelledby={askTitle} data-step="2" data-ready={repo ? '' : undefined}>
          <h2 className={styles.stepTitle} id={askTitle}>
            <span className={styles.stepNum}>2</span> · Ask it a question
          </h2>
          {repo ? (
            <AskBody repo={repo} groups={groups} onAsk={question => router.push(repoPath(repo, question))} />
          ) : (
            <p className={styles.waiting}>{WORDS.waiting}</p>
          )}
        </section>
      </div>

      <HowItWorks preview={preview} />
    </Frame>
  )
}

/** Step 2 once a repo is chosen: a question of the reader's own, or one of the twelve. It wipes in when it arrives. */
function AskBody({ repo, groups, onAsk }: { repo: string; groups: QuestionGroup[]; onAsk: (question: string) => void }) {
  const body = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!body.current) return
    const tl = wipe(body.current)
    return () => {
      tl.progress(1).kill()
    }
  }, [])

  return (
    <div ref={body} className={styles.askBody} data-ask-body="">
      <p className={styles.askLead}>
        Each kind of question composes a different screen for <code>{repo}</code>.
      </p>
      <AskField repo={repo} onAsk={onAsk} />
      <p className={styles.or}>{WORDS.or}</p>
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
    </div>
  )
}

/** The reader's own question, as the composed screen's tray takes it: up to 300 characters, sent on Enter. */
function AskField({ repo, onAsk }: { repo: string; onAsk: (question: string) => void }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')

  // Asking with nothing typed puts the reader in the field, which is what the button was for.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const question = text.trim()
    if (question) onAsk(question)
    else input.current?.focus()
  }

  return (
    <form className={styles.ask} onSubmit={submit} data-ask="">
      <label className="sr-only" htmlFor={id}>
        {`Your question about ${repo}`}
      </label>
      <div className={styles.askBox}>
        <input
          ref={input}
          id={id}
          className={styles.askInput}
          name="question"
          type="text"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={QUESTION_MAX}
          placeholder={WORDS.ask}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit" className={styles.askButton}>
          Ask
        </button>
      </div>
    </form>
  )
}
