'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { gsap } from 'gsap'
import { RepoChip } from '@genui-github/ui'
import { count, rise, slide, wipe } from '@genui-github/ui/motion'
import type { Ask, Built } from '@genui-github/renderer'
import styles from './Chrome.module.css'
import { Hint } from './Hint'
import { ago, modelName, MIDDOT, plural, seconds, templateLine } from './words'

export interface ChromeProps {
  repo: string
  question: string
  askedAt: number
  /** A sample repo carries the day its data was read: sample data is marked. */
  sampleDay?: string
  /** The receipt, once the composition is done. Screens where nothing was composed have none. */
  built?: Built
  pieces?: number
  cachedAt?: string
  asks?: Ask[]
  /** A line under the question for the whole screen's condition, such as cached-only mode. */
  notice?: ReactNode
  /** The first-visit line saying the answer is clickable, shown until the reader clicks into it. */
  hint?: boolean
  /** False runs the chrome's exit; true again runs its entrance. */
  shown: boolean
  reduced: boolean
  onAsk?: (ask: string) => void
  onOpenDrawer?: () => void
  onExited?: () => void
}

const kill = (tl: gsap.core.Timeline | null) => {
  tl?.progress(1)
  tl?.kill()
}

/** The hint is the chrome's last line, so it wipes in after the follow-up questions have started to slide. */
const HINT_AT = 0.5

/** The follow-up block's parts in reading order: the "Ask next" eyebrow, then each chip. They slide as one set. */
const askParts = (nav: HTMLElement): Element[] => [...nav.querySelectorAll('[data-asks-label], [data-ask]')]

/** "asked just now", kept fresh while the screen is open. */
function useAgo(at: number) {
  const [now, setNow] = useState(at)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return ago(at, Math.max(now, at))
}

/**
 * The chrome composes first (design-system/motion.md, Entrance 1): the eyebrow chips slide, the question
 * wipes, the built block rises and its figure counts, the follow-up questions slide. Exit is the reverse.
 */
export function Chrome({ repo, question, askedAt, sampleDay, built, pieces, cachedAt, asks, notice, hint, shown, reduced, onAsk, onOpenDrawer, onExited }: ChromeProps) {
  const eyebrow = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const receipt = useRef<HTMLButtonElement>(null)
  const figure = useRef<HTMLSpanElement>(null)
  const chips = useRef<HTMLElement>(null)
  const asksId = useId()
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const [shownQuestion, setShownQuestion] = useState(question)
  const head = useRef<gsap.core.Timeline | null>(null)
  const askedWords = useAgo(askedAt)

  // A new question: the old one wipes out, then the new one is set and wipes in.
  useLayoutEffect(() => {
    if (question === shownQuestion || !heading.current) return
    kill(head.current)
    const tl = wipe(heading.current, { direction: 'out', reduced })
    tl.eventCallback('onComplete', () => setShownQuestion(question))
    head.current = tl
  }, [question, shownQuestion, reduced])

  useLayoutEffect(() => {
    if (!shown || !heading.current || !eyebrow.current) return
    kill(head.current)
    const tl = wipe(heading.current, { reduced })
    tl.add(slide([...eyebrow.current.children], { reduced }), 0)
    head.current = tl
    return () => kill(tl)
  }, [shownQuestion, shown, reduced])

  const builtKey = built ? `${built.template}:${built.latencyMs.total}` : ''
  useLayoutEffect(() => {
    if (!shown || !built || !receipt.current) return
    const tl = rise(receipt.current, { reduced, delay: reduced ? 0 : 0.18 })
    if (figure.current) tl.add(count(figure.current, { to: seconds(built.latencyMs.total), reduced, format: v => v.toFixed(1) }), reduced ? 0 : 0.18)
    return () => kill(tl)
    // builtKey stands for the receipt's identity; the object itself changes on every stream op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builtKey, shown, reduced])

  const asksKey = (asks ?? []).map(a => a.ask).join('\n')
  useLayoutEffect(() => {
    if (!shown || !chips.current || !asksKey) return
    const tl = slide(askParts(chips.current), { reduced, delay: reduced ? 0 : 0.36 })
    return () => kill(tl)
  }, [asksKey, shown, reduced])

  useLayoutEffect(() => {
    if (!shown || !noticeRef.current) return
    const tl = wipe(noticeRef.current, { reduced, delay: reduced ? 0 : 0.18 })
    return () => kill(tl)
  }, [notice, shown, reduced])

  // The exit: chips first, then the receipt, the question and the eyebrow, the entrance run backwards.
  useLayoutEffect(() => {
    if (shown) return
    const parts = [chips.current ? askParts(chips.current) : [], noticeRef.current, receipt.current, heading.current, eyebrow.current ? [...eyebrow.current.children] : []]
    const tl = slide(parts[0] as Element[], { direction: 'out', reduced })
    if (parts[1]) tl.add(wipe(parts[1] as Element, { direction: 'out', reduced }), reduced ? 0 : 0.08)
    if (parts[2]) tl.add(rise(parts[2] as Element, { direction: 'out', reduced }), reduced ? 0 : 0.08)
    if (parts[3]) tl.add(wipe(parts[3] as Element, { direction: 'out', reduced }), reduced ? 0 : 0.16)
    tl.add(slide(parts[4] as Element[], { direction: 'out', reduced }), reduced ? 0 : 0.24)
    tl.eventCallback('onComplete', () => onExited?.())
    return () => kill(tl)
  }, [shown, reduced, onExited])

  return (
    <header className={styles.chrome} data-chrome="">
      <div className={styles.top}>
        <div>
          <div className={styles.eyebrow} ref={eyebrow}>
            <RepoChip repo={repo} className={styles.repo} />
            {sampleDay && <span className={styles.sample}>sample{MIDDOT}read {sampleDay}</span>}
            <span className={styles.note}>asked {askedWords}</span>
          </div>
          <h1 className={styles.question} ref={heading} data-question="">
            {shownQuestion}
          </h1>
        </div>
        {built && (
          <button type="button" className={styles.built} ref={receipt} onClick={onOpenDrawer} aria-haspopup="dialog" data-built="">
            <span className={styles.num}>
              <span ref={figure}>{seconds(built.latencyMs.total).toFixed(1)}</span>
              <small>s</small>
            </span>
            <span className={styles.meta}>
              composed by {modelName(built.model)}
              {pieces !== undefined && `${MIDDOT}${plural(pieces, 'component')}`}
            </span>
            {cachedAt ? (
              <span className={`${styles.meta} ${styles.cached}`}>from cache{MIDDOT}composed {ago(cachedAt)}</span>
            ) : (
              <span className={styles.meta}>{templateLine(built)}</span>
            )}
            <span className="sr-only">. How this was built</span>
          </button>
        )}
      </div>
      {notice && (
        <p className={styles.notice} ref={noticeRef} role="status">
          {notice}
        </p>
      )}
      {asks && asks.length > 0 && (
        <nav className={styles.next} aria-labelledby={asksId} ref={chips}>
          <p className={styles.eyebrowLabel} id={asksId} data-asks-label="">
            Ask next
          </p>
          <div className={styles.asks}>
            {asks.map(a => (
              <button key={a.ask} type="button" className={styles.ask} onClick={() => onAsk?.(a.ask)} data-ask="">
                {a.ask}
              </button>
            ))}
          </div>
        </nav>
      )}
      <Hint show={Boolean(hint) && shown} reduced={reduced} delay={HINT_AT} />
    </header>
  )
}
