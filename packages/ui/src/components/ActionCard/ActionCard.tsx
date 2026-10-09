'use client'

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Mark, Skeleton, SkeletonBlock, TextLink } from '../../parts'
import { bloom, MOVES, wipe } from '../../motion'
import type { PieceRenderProps } from '../../types'
import { effectWords, type ActionCardProps } from './schema'
import styles from './ActionCard.module.css'

/** Confirm ignores activation this long after it appears, so a double click lands on the question, not on Confirm. */
export const CONFIRM_GUARD_MS = 400

type Phase = 'idle' | 'confirming' | 'working' | 'done' | 'failed'

/** Identifiers (the targets) set in mono at .85em. */
function withTargets(text: string, targets: string[]): ReactNode[] {
  if (!targets.length) return [text]
  const pattern = new RegExp(`(${targets.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return text.split(pattern).map((part, i) => (targets.includes(part) ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>))
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" />
    </svg>
  )
}

export function ActionCard({ props, state, error, onAsk, onRetry, onOpenDrawer }: PieceRenderProps<ActionCardProps>) {
  const { heading, body, primary, secondary, effect } = props
  const [chosen, setPhase] = useState<Phase>('idle')
  // A failed piece shows the failed row until the reader acts on it.
  const phase: Phase = state === 'error' && chosen === 'idle' ? 'failed' : chosen
  const [step, setStep] = useState(0)
  const [showDrafts, setShowDrafts] = useState(false)
  const shownAt = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const linkRef = useRef<HTMLDivElement>(null)
  const questionId = useId()
  const lastPhase = useRef<Phase | null>(null)
  const n = effect.targets.length

  // Sample mode drafts one target per extend, the pace the bar fills at; nothing is written anywhere.
  useEffect(() => {
    if (phase !== 'working') return
    const timer = window.setTimeout(() => {
      if (step + 1 >= n) setPhase('done')
      setStep(s => s + 1)
    }, MOVES.extend.in * 1000)
    return () => window.clearTimeout(timer)
  }, [phase, step, n])

  // Each change of phase is caused by the reader: the new words wipe in, focus goes where the next action is.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    // Only a change of phase is the reader acting. Arriving (and a dev double run) moves no focus and wipes nothing.
    const changed = lastPhase.current !== null && lastPhase.current !== phase
    lastPhase.current = phase
    if (!changed) return
    const fresh = root.querySelector<HTMLElement>('[data-question], [data-result-title]')
    const tl = fresh && phase !== 'idle' ? wipe(fresh) : undefined
    if (phase === 'confirming') {
      shownAt.current = performance.now()
      confirmRef.current?.focus()
    }
    if (phase === 'working') resultRef.current?.focus()
    if (phase === 'done' || phase === 'failed') linkRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    const layer = root.querySelector<HTMLElement>('[data-bloom]')
    const glow = phase === 'done' && layer ? bloom(layer) : undefined
    return () => {
      tl?.progress(1).kill()
      glow?.progress(1).kill()
    }
  }, [phase])

  const cancel = () => {
    setPhase('idle')
    requestAnimationFrame(() => primaryRef.current?.focus())
  }
  const confirm = () => {
    if (performance.now() - shownAt.current < CONFIRM_GUARD_MS) return
    setStep(0)
    setPhase('working')
  }
  const retry = () => {
    onRetry?.()
    setStep(0)
    setPhase('working')
  }
  const drafts = effect.targets.map(t => effectWords.draft(effect, t))
  const openDrafts = () => (onOpenDrawer ? onOpenDrawer({ title: effectWords.done(effect), items: drafts }) : setShowDrafts(v => !v))

  if (state === 'skeleton') {
    return (
      <div className={styles.root} data-piece="ActionCard">
        <section className={styles.card} aria-busy="true" aria-label="Preparing a suggested action">
          <Skeleton text="action" width="70%" />
          <div className={styles.copySkeleton}>
            <Skeleton text="body" width="95%" />
            <Skeleton text="body" width="60%" />
          </div>
          <div className={styles.buttons}>
            <SkeletonBlock width="8.5rem" height="var(--control-h)" className={styles.buttonSkeleton} />
            <SkeletonBlock width="9rem" height="var(--control-h)" className={styles.buttonSkeleton} />
          </div>
          <Skeleton text="meta" width="55%" className={styles.lineSkeleton} />
          <span className="sr-only">Preparing a suggested action.</span>
        </section>
      </div>
    )
  }

  const working = phase === 'working'
  const sampleLine = (words: ReactNode) => (
    <>
      <b>sample</b> · {words}
    </>
  )

  return (
    <div className={styles.root} ref={rootRef} data-piece="ActionCard">
      <span className={styles.bloom} data-bloom="" aria-hidden="true" />
      <section className={styles.card} aria-labelledby={`${questionId}-h`} data-phase={phase}>
        <h3 id={`${questionId}-h`} className={styles.heading} data-wipe="">
          {heading}
        </h3>
        <p className={styles.copy} data-wipe="">
          {body}
        </p>

        {(phase === 'idle' || phase === 'confirming') && (
          <>
            {phase === 'confirming' && (
              <p id={questionId} className={styles.question} data-question="">
                {withTargets(effectWords.question(effect), effect.targets)}
              </p>
            )}
            <div className={styles.buttons}>
              {phase === 'idle' ? (
                <>
                  <button ref={primaryRef} type="button" className={styles.button} data-primary="" onClick={() => setPhase('confirming')}>
                    {primary}
                  </button>
                  {secondary &&
                    ('href' in secondary ? (
                      <a className={styles.button} href={secondary.href} target="_blank" rel="noreferrer">
                        {secondary.label}
                        <Arrow />
                      </a>
                    ) : (
                      <button type="button" className={styles.button} onClick={() => onAsk?.(secondary.ask)}>
                        {secondary.label}
                      </button>
                    ))}
                </>
              ) : (
                <>
                  <button
                    ref={confirmRef}
                    type="button"
                    className={styles.button}
                    data-primary=""
                    aria-describedby={questionId}
                    onClick={confirm}
                    onKeyDown={e => e.key === 'Escape' && cancel()}
                  >
                    Confirm
                  </button>
                  <button type="button" className={styles.button} onClick={cancel} onKeyDown={e => e.key === 'Escape' && cancel()}>
                    Cancel
                  </button>
                </>
              )}
            </div>
            <p className={styles.line} data-wipe="">
              {sampleLine(phase === 'idle' ? effectWords.would(effect) : effectWords.confirmLine)}
            </p>
          </>
        )}

        {(working || phase === 'done' || phase === 'failed') && (
          <div className={styles.result} ref={resultRef} role="status" tabIndex={-1}>
            <Mark kind={working ? 'warming' : phase === 'done' ? 'good' : 'unavailable'} className={styles.resultMark} />
            <div className={styles.resultText}>
              <span className={styles.resultTitle} data-quiet={working || undefined} data-result-title="">
                {working
                  ? effectWords.working(effect, Math.min(step + 1, n))
                  : phase === 'done'
                    ? effectWords.done(effect)
                    : (error?.failed ?? effectWords.failed(effect))}
              </span>
              <span className={styles.line}>
                {sampleLine(
                  working
                    ? `reading ${effect.targets[Math.min(step, n - 1)]} · nothing is posted`
                    : phase === 'done'
                      ? effectWords.doneLine
                      : (error?.cause ?? 'GitHub did not answer'),
                )}
              </span>
            </div>
            <div ref={linkRef} className={styles.resultLink}>
              {phase === 'done' && <TextLink onClick={openDrafts}>View drafts</TextLink>}
              {phase === 'failed' && <TextLink onClick={retry}>Try again</TextLink>}
            </div>
          </div>
        )}

        {phase === 'done' && showDrafts && (
          <ul className={styles.drafts}>
            {drafts.map(d => (
              <li key={d}>{withTargets(d, effect.targets)}</li>
            ))}
          </ul>
        )}

        {working && (
          <span className={styles.progress} aria-hidden="true">
            <span className={styles.fill} data-bar="" style={{ '--progress': step / n } as CSSProperties} />
          </span>
        )}
      </section>
    </div>
  )
}
