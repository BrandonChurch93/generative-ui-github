'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ComponentType, type FormEvent, type MouseEvent } from 'react'
import { RepoChip, TextInput as TextInputPiece, type PieceRenderProps } from '@genui-github/ui'
import { prefersReducedMotion } from '@genui-github/ui/motion'
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
  pickFirst: 'Pick a repo first',
  action: 'Use repo',
  samples: 'Or try a sample GitHub repo',
  recent: 'Recent',
  ask: 'Type your own question',
  or: 'or pick one',
} as const

type Resolution = { ok: true; repo: string; sample: boolean } | { ok: false; message: string; kind: 'missing' | 'shape' | 'unreachable' }

/** A typed repo un-mutes step 2 once the typing pauses, so it does not wipe in halfway through a name. */
const SETTLE_MS = 400

/** Step 2 counts as below the fold once its top is past this share of the viewport: its field would be out of sight. */
const FOLD = 2 / 3

/** The route's limit on a question, which the tray keeps too. */
const QUESTION_MAX = 300

/**
 * The landing: the sentence, then the journey in two numbered steps (pick a repo, ask it a question), then how it
 * works. Step 2 is always whole but muted until a repo is chosen, then turns to ink and comes alive. Choosing a repo
 * never leaves the page; only a question opens the composed screen.
 */
export function Landing({ samples, groups, preview }: { samples: string[]; groups: QuestionGroup[]; preview: LandingPreview | null }) {
  const router = useRouter()
  const [repo, setRepo] = useState<string>()
  // What the hero field shows when the page sets it (a sample, the recent repo), and what GitHub said about it.
  const [fieldValue, setFieldValue] = useState<string>()
  const [status, setStatus] = useState<TextInput.FieldStatus>()
  const [pickFirst, setPickFirst] = useState(false)
  // Read after hydration: the server never knows it, so the first paint matches and the slot is reserved.
  const last = useSyncExternalStore(onLastRepoChange, lastRepo, () => undefined)
  const pickStep = useRef<HTMLElement>(null)
  const askStep = useRef<HTMLElement>(null)
  const typing = useRef<number | undefined>(undefined)
  const asking = useRef<AbortController | null>(null)
  const pickTitle = useId()
  const askTitle = useId()
  const samplesLabel = useId()

  const stopChecking = () => {
    window.clearTimeout(typing.current)
    asking.current?.abort()
  }
  useEffect(() => stopChecking, [])

  /** Asks the server whether the repo exists and is public. Choosing it never leaves the page. */
  const check = async (value: string) => {
    stopChecking()
    const parsed = parseRepo(value)
    if (!parsed.ok) {
      setRepo(undefined)
      setStatus({ kind: 'invalid', problem: parsed.problem })
      return
    }
    const abort = new AbortController()
    asking.current = abort
    setStatus({ kind: 'checking' })
    try {
      const response = await fetch(`/api/resolve?repo=${encodeURIComponent(value.trim())}`, { signal: abort.signal })
      const found = (await response.json()) as Resolution
      if (abort.signal.aborted) return
      if (found.ok) {
        setRepo(found.repo)
        setStatus({ kind: 'resolved', value: found.repo })
        setPickFirst(false)
      } else {
        setRepo(undefined)
        setStatus(found.kind === 'unreachable' ? { kind: 'unreachable', cause: found.message } : { kind: 'invalid', problem: found.kind === 'shape' ? 'repo-format' : 'repo-missing' })
      }
    } catch {
      if (abort.signal.aborted) return
      setRepo(undefined)
      setStatus({ kind: 'unreachable', cause: 'the network request failed' })
    }
  }

  // The hero field keeps its own value; its input events bubble here. Editing unchooses the repo until it checks out.
  const typed = (event: FormEvent<HTMLDivElement>) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    stopChecking()
    setRepo(undefined)
    setStatus(undefined)
    const value = input.value
    // Mirrored, so picking a sample after typing always reads as a new value to the field and fills it.
    setFieldValue(value)
    if (!parseRepo(value).ok) return
    typing.current = window.setTimeout(() => void check(value), SETTLE_MS)
  }

  /** A sample or the recent repo: chosen at once, the field filled with its name. */
  const choose = (name: string) => {
    stopChecking()
    setRepo(name)
    setFieldValue(name)
    setStatus({ kind: 'resolved', value: name })
    setPickFirst(false)
    // A click commits before the next frame, so step 2 is live by then. Low on the screen, it comes up.
    requestAnimationFrame(() => {
      const step = askStep.current
      if (!step || step.getBoundingClientRect().top < window.innerHeight * FOLD) return
      step.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    })
  }

  /** Step 2 touched before a repo is chosen: back to the repo field, with the hint under it. */
  const needRepo = () => {
    setPickFirst(true)
    const input = pickStep.current?.querySelector<HTMLInputElement>('input')
    input?.focus({ preventScroll: true })
    pickStep.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
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
        <section ref={pickStep} className={styles.step} aria-labelledby={pickTitle} data-step="1">
          <h2 className={styles.stepTitle} id={pickTitle}>
            <span className={styles.stepNum}>1</span> · Pick a repo
          </h2>
          <div className={styles.pick}>
            <div className={styles.paste} onInput={typed} data-chosen={repo ? '' : undefined}>
              <Field
                state="default"
                props={{
                  label: 'Public GitHub repository',
                  kind: 'identifier',
                  validate: 'repo',
                  size: 'hero',
                  placeholder: WORDS.placeholder,
                  helper: pickFirst ? WORDS.pickFirst : WORDS.helper,
                  action: WORDS.action,
                  ...(fieldValue !== undefined ? { value: fieldValue } : {}),
                  status,
                  onSubmit: value => void check(value),
                }}
              />
              <div className={styles.offer}>
                {last && (
                  <p className={styles.recent} data-offer="">
                    <span className={styles.recentLabel}>{WORDS.recent}</span>
                    <button type="button" className={styles.recentButton} aria-pressed={last === repo} onClick={() => choose(last)}>
                      <RepoChip repo={last} selected={last === repo} className={styles.recentChip} />
                    </button>
                  </p>
                )}
              </div>
            </div>
            <div className={styles.samples}>
              <p className={styles.eyebrow} id={samplesLabel}>
                {WORDS.samples}
              </p>
              <div className={styles.chips} role="group" aria-labelledby={samplesLabel}>
                {samples.map(name => (
                  <button key={name} type="button" className={styles.sample} aria-pressed={name === repo} onClick={() => choose(name)} data-sample="">
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
          <AskBody repo={repo} groups={groups} onAsk={question => repo && router.push(repoPath(repo, question))} onNeedRepo={needRepo} />
        </section>
      </div>

      <HowItWorks preview={preview} />
    </Frame>
  )
}

/**
 * Step 2, always whole: a question of the reader's own, then the twelve. Until a repo is chosen it is muted and
 * nothing in it acts; touching it sends the reader back to step 1.
 */
function AskBody({ repo, groups, onAsk, onNeedRepo }: { repo?: string; groups: QuestionGroup[]; onAsk: (question: string) => void; onNeedRepo: () => void }) {
  const off = !repo
  return (
    <div className={styles.askBody} data-ask-body="" data-off={off ? '' : undefined}>
      <p className={styles.askLead}>
        Each kind of question composes a different screen for {repo ? <code>{repo}</code> : 'the repo you pick'}.
      </p>
      <AskField repo={repo} onAsk={onAsk} onNeedRepo={onNeedRepo} />
      <p className={styles.or}>{WORDS.or}</p>
      <ul className={styles.groups}>
        {groups.map(group => (
          <li key={group.label} className={styles.group} data-group={group.label}>
            <div>
              <h3>{group.label}</h3>
              <p>{group.draws}</p>
            </div>
            <div className={styles.qchips}>
              {group.questions.map(question =>
                repo ? (
                  <Link key={question} className={styles.qchip} href={repoPath(repo, question)} prefetch={false} data-question="">
                    {question}
                  </Link>
                ) : (
                  // Not disabled outright: a disabled button takes no click, and the click is what says "pick a repo first".
                  <button key={question} type="button" className={styles.qchip} aria-disabled="true" onClick={onNeedRepo} data-question="">
                    {question}
                  </button>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The reader's own question, as the composed screen's tray takes it: up to 300 characters, sent on Enter. */
function AskField({ repo, onAsk, onNeedRepo }: { repo?: string; onAsk: (question: string) => void; onNeedRepo: () => void }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const off = !repo

  // Asking with nothing typed puts the reader in the field, which is what the button was for.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (off) return onNeedRepo()
    const question = text.trim()
    if (question) onAsk(question)
    else input.current?.focus()
  }

  return (
    <form className={styles.ask} onSubmit={submit} data-ask="">
      <label className="sr-only" htmlFor={id}>
        {repo ? `Your question about ${repo}` : 'Your question, once a repo is picked'}
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
          readOnly={off}
          aria-disabled={off || undefined}
          onChange={e => setText(e.target.value)}
          // The field stays reachable so a tap or a key can say what it needs first.
          onPointerDown={off ? event => (event.preventDefault(), onNeedRepo()) : undefined}
          onKeyDown={off ? event => event.key !== 'Tab' && !event.metaKey && !event.ctrlKey && (event.preventDefault(), onNeedRepo()) : undefined}
        />
        <button type="submit" className={styles.askButton} aria-disabled={off || undefined}>
          Ask
        </button>
      </div>
    </form>
  )
}
