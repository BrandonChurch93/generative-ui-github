'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { gsap } from 'gsap'
import { useReducedMotion } from 'motion/react'
import { CardFrame, Mark, TextLink } from '@genui-github/ui'
import { CHOREOGRAPHY, extend, fade, rise, slide, wipe } from '@genui-github/ui/motion'
import styles from './SystemScreens.module.css'
import type { Refusal } from './useComposition'
import { clock, MIDDOT, plural } from './words'

export interface SystemScreenProps {
  repo: string
  refusal: Refusal
  timeZone?: string
  onRetry: () => void
  /** The question that was refused. Without it, the one in the address bar. */
  question?: string
}

/** The sample repos (docs/decisions.md, Product): they answer from their committed copy of GitHub's data. */
const SAMPLES = ['vercel/next.js', 'facebook/react', 'anthropics/claude-code', 'tailwindlabs/tailwindcss', 'vitejs/vite'] as const
/** A golden question, so a sample answers it from cache even when live questions are paused. */
const OVERVIEW = "How's this repo doing?"
/** GitHub's primary limit is hourly, so a reset time also says how much of the wait has passed. */
const WINDOW_MS = 60 * 60_000
const LEAD_FOLLOW = 0.12
const CARD_AT = CHOREOGRAPHY.regionStagger.min

const SAME = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const pathFor = (repo: string, question: string) => `/r/${repo}?q=${encodeURIComponent(question)}`

function askedQuestion(given?: string): string | undefined {
  if (given) return given
  if (typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).get('q') ?? undefined
}

/** "12:23", or "1:04:09" past an hour: what is left, tabular, in the countdown. */
function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  return now
}

/**
 * The entrance (design-system/motion.md, Entrance 2 to 4, in WarmingUp's lead rhythm): the sentence wipes, the
 * lines under it follow, the cards rise one after another, the countdown wipes and the bar extends to where
 * the wait stands.
 */
function useEntrance(root: RefObject<HTMLDivElement | null>, key: string, reduced: boolean) {
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const options = { reduced }
    // The answer's slot composes after the chrome above it (Entrance 1 then 2).
    const tl = gsap.timeline({ delay: reduced ? 0 : CHOREOGRAPHY.regionStagger.min })
    const say = el.querySelector('[data-say]')
    if (say) tl.add(wipe(say, options), 0)
    const mark = el.querySelector('[data-lead] [data-mark]')
    if (mark) tl.add(fade(mark), 0)
    const lines = [...el.querySelectorAll('[data-why], [data-when]')]
    if (lines.length) tl.add(wipe(lines, options), reduced ? 0 : LEAD_FOLLOW)
    el.querySelectorAll('[data-card]').forEach((card, i) => {
      const at = reduced ? 0 : CARD_AT + i * CHOREOGRAPHY.metricStagger
      tl.add(rise(card, options), at)
      const figure = card.querySelector('[data-countdown]')
      if (figure) tl.add(wipe(figure, options), at)
      const chips = [...card.querySelectorAll('[data-repo-link]')]
      if (chips.length) tl.add(slide(chips, options), at)
      const fill = card.querySelector<HTMLElement>('[data-progress] > *')
      if (fill) {
        const to = Number(getComputedStyle(fill).getPropertyValue('--progress')) || 0
        // The bar is drawn by its custom property once the entrance is over, so it keeps filling each second.
        tl.add(extend(fill, { ...options, to }).eventCallback('onComplete', () => gsap.set(fill, { clearProps: 'transform,transformOrigin,opacity' })), at)
      }
    })
    return () => {
      tl.progress(1)
      tl.kill()
    }
  }, [root, key, reduced])
}

function Lead({ say, why, when, children }: { say: string; why?: ReactNode; when?: ReactNode; children?: ReactNode }) {
  return (
    <section className={styles.lead} data-lead="" aria-labelledby="system-say">
      <span className={styles.leadMark}><Mark kind="unavailable" /></span>
      <p className={styles.say} id="system-say" role="status" data-say="">
        {say}
      </p>
      {why && (
        <p className={styles.why} data-why="">
          {why}
        </p>
      )}
      {(when || children) && (
        <p className={styles.when} data-when="">
          {when && <span>{when}</span>}
          {children}
        </p>
      )}
    </section>
  )
}

function ResetCard({ resetAt, timeZone, onRetry }: { resetAt?: string; timeZone?: string; onRetry: () => void }) {
  const reset = resetAt ? Date.parse(resetAt) : NaN
  const known = Number.isFinite(reset)
  const now = useNow(known)
  const left = known ? Math.max(0, reset - now) : 0
  // Only a countdown this screen watched run out asks again by itself: a reset already past would loop.
  const armed = useRef(left > 0)
  useEffect(() => {
    if (armed.current && known && left === 0) {
      armed.current = false
      onRetry()
    }
  }, [known, left, onRetry])
  const minutes = Math.ceil(left / 60_000)
  return (
    <CardFrame title="GitHub rate limit" meta={known ? `resets ${clock(resetAt!, timeZone)}` : undefined} progress={known ? 1 - Math.min(1, left / WINDOW_MS) : undefined}>
      <div className={styles.body}>
        {known ? (
          <>
            <span className="sr-only">Resets in {plural(minutes, 'minute')}.</span>
            <span className={styles.count} data-countdown="" aria-hidden="true">
              {countdown(left)}
            </span>
            <span className={styles.note}>until it resets</span>
          </>
        ) : (
          <span className={styles.note}>GitHub didn&apos;t send a reset time</span>
        )}
        <p className={styles.again}>
          <span>{known ? 'asks again by itself then' : 'try again in a few minutes'}</span>
          <TextLink onClick={onRetry} className={styles.retry}>
            Try again
          </TextLink>
        </p>
      </div>
    </CardFrame>
  )
}

function StillAnswering({ repo, question, sameQuestion }: { repo: string; question: string; sameQuestion: boolean }) {
  const repos = SAMPLES.filter(s => !SAME(s, repo))
  return (
    <CardFrame title="Still answering" meta={`from cache${MIDDOT}${plural(repos.length, 'repo')}`}>
      <div className={styles.body}>
        <p className={styles.p}>
          {sameQuestion
            ? "These repos have a recent copy of GitHub's data and still answer right away. Pick one to ask the same question there."
            : "These repos have a recent copy of GitHub's data and answer the starter questions from cache. Pick one to see how it's doing."}
        </p>
        <ul className={styles.repos}>
          {repos.map(r => (
            <li key={r}>
              <a className={styles.repo} href={pathFor(r, question)} data-repo-link="">
                {r}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </CardFrame>
  )
}

/**
 * What takes the answer's place when the app could not compose one: rate limit, daily cap, visitor limit,
 * a repo it cannot read, a request that failed. The system's sentence sits in the Insight slot with the
 * unavailable mark (never crit); the chrome above shows nothing that was not composed.
 */
export function SystemScreen({ repo, refusal, timeZone, onRetry, question: given }: SystemScreenProps) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion() ?? false
  const question = useMemo(() => askedQuestion(given) ?? OVERVIEW, [given])
  useEntrance(root, `${refusal.error}:${refusal.message}`, reduced)
  const opens = refusal.resetAt ? `New questions open at ${clock(refusal.resetAt, timeZone)}` : undefined

  let content: ReactNode
  switch (refusal.error) {
    case 'rate-limit':
      content = (
        <>
          <Lead say={refusal.message} why="Everyone using this app shares one allowance from GitHub, and it has run out for now. Nothing is wrong with the repo or your question." />
          <div className={styles.split}>
            <ResetCard resetAt={refusal.resetAt} timeZone={timeZone} onRetry={onRetry} />
            <StillAnswering repo={repo} question={question} sameQuestion />
          </div>
        </>
      )
      break
    case 'daily-cap':
    case 'visitor-limit':
      content = (
        <>
          <Lead
            say={refusal.message}
            why={
              refusal.error === 'daily-cap'
                ? "Today's model budget is spent, so nothing new is composed until it resets. Answers already composed still open from cache."
                : 'Each visitor has a daily allowance of live questions, so the budget lasts for everyone. Answers already composed still open from cache.'
            }
            when={opens}
          />
          <div className={styles.single}>
            <StillAnswering repo={repo} question={OVERVIEW} sameQuestion={false} />
          </div>
        </>
      )
      break
    case 'repo':
      content = (
        <Lead say={refusal.message} why="This app reads public repos on github.com, named as owner/name or pasted as a link.">
          <TextLink href="/">Try another repo</TextLink>
        </Lead>
      )
      break
    default:
      content = (
        <Lead say={refusal.message} why="Nothing was composed for this question.">
          <TextLink onClick={onRetry}>Try again</TextLink>
        </Lead>
      )
  }

  return (
    <div className={styles.system} ref={root} data-system={refusal.error}>
      {content}
    </div>
  )
}
