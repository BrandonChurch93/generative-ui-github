'use client'

import { useId, useLayoutEffect, useRef, useState, type MouseEvent, type Ref, type RefObject } from 'react'
import { gsap } from 'gsap'
import { motion, usePresence, useReducedMotion } from 'motion/react'
import { createLogger } from '@genui-github/core'
import type { CatalogEntry } from '@genui-github/ui/catalog'
import { MOVES, prefersReducedMotion } from '@genui-github/ui/motion'
import { INSIDE_DELAY, type Conductor } from '@genui-github/renderer'
import type { ComponentState } from '@genui-github/ui'
import {
  ARRIVE,
  FILL_AFTER,
  FIRST_FILL,
  heightWord,
  isStill,
  useStill,
  later,
  omittedStates,
  propsFor,
  riseIn,
  shownStates,
  SINK_AFTER,
  sinkOut,
  STAGGER,
  STATE_LABELS,
} from './stage'
import styles from './gallery.module.css'

const log = createLogger('components')

export interface CardHandle {
  /** The strict reverse of the entrance, `at` seconds from now. Null leaves at once: the card is out of sight. */
  exit(at: number | null): Promise<void>
}

interface Settles {
  complete(): void
}

const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role="button"], [role="radio"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"], [contenteditable="true"]'

export interface CardProps {
  entry: CatalogEntry
  /** Seconds after the set starts that this card rises. */
  delay: number
  /** The server drew this card's frame, so it is already in place. */
  prerendered: boolean
  focused: boolean
  conductor: Conductor
  /** Set by the grid when the whole set is leaving: nothing new starts. */
  leaving: RefObject<boolean>
  register: (name: string, handle: CardHandle | null) => void
  onToggle: (name: string) => void
  ref?: Ref<HTMLDivElement>
}

function Piece({ entry, state }: { entry: CatalogEntry; state: ComponentState }) {
  const { Component, sample } = entry
  return (
    <Component
      props={propsFor(entry, state)}
      state={state}
      error={sample.error}
      warming={sample.warming}
      onRetry={() => log.info('try again pressed', { component: entry.name, state })}
      onAsk={ask => log.info('ask', { component: entry.name, ask })}
    />
  )
}

/**
 * One component in the set. Motion owns the cell (its layout move when the set reflows) and the lift inside it
 * (the rise and the sink); the component's own motion.ts runs what is inside, as on a composed screen.
 */
export function Card({ entry, delay, prerendered, focused, conductor, leaving, register, onToggle, ref }: CardProps) {
  const [isPresent, safeToRemove] = usePresence()
  const media = useReducedMotion()
  const omitted = omittedStates(entry)
  const canSkeleton = !omitted.has('skeleton')
  const [filled, setFilled] = useState(false)
  const [replays, setReplays] = useState(0)
  const [showJson, setShowJson] = useState(false)
  const lift = useRef<HTMLDivElement>(null)
  const piece = useRef<HTMLDivElement>(null)
  const filledNow = useRef(filled)
  const gone = useRef(false)
  const entering = useRef<Settles[]>([])
  const shownFocus = useRef(`${focused}:${replays}`)
  const detailsId = useId()
  const still = useStill()
  const hidden = !still && !(prerendered && canSkeleton)

  useLayoutEffect(() => {
    filledNow.current = filled || still
  })

  // A component that has no skeleton waits unseen until its turn, then arrives drawn, the way a composed screen places it.
  const state: ComponentState = filled || still || !canSkeleton ? 'default' : 'skeleton'

  const settleEntering = () => {
    entering.current.forEach(s => s.complete())
    entering.current = []
  }

  const track = (tl: gsap.core.Timeline) =>
    new Promise<void>(resolve => {
      conductor.timeline(tl, conductor.generation, resolve)
    })

  const exit = (at: number | null): Promise<void> => {
    gone.current = true
    settleEntering()
    const el = lift.current
    if (at === null || !el || (!filledNow.current && !canSkeleton)) return Promise.resolve()
    const reduced = prefersReducedMotion()
    const root = piece.current?.firstElementChild
    const waits: Promise<unknown>[] = []
    let inside = 0
    if (filledNow.current && entry.motion && root instanceof HTMLElement) {
      try {
        const tl = entry.motion.exit(root, propsFor(entry, 'default'), { reduced })
        inside = tl.duration()
        waits.push(track(later(at, tl)))
      } catch (error) {
        log.warn('exit failed; the card sinks as drawn', { component: entry.name, error: (error as Error).message })
      }
    }
    waits.push(conductor.motion(sinkOut(el, at + Math.min(inside / 2, SINK_AFTER), reduced)).finished)
    return Promise.all(waits).then(() => undefined)
  }

  useLayoutEffect(() => {
    register(entry.name, { exit })
    return () => register(entry.name, null)
  })

  // The entrance: the frame rises in its skeleton, then fills.
  useLayoutEffect(() => {
    if (isStill()) {
      lift.current?.style.setProperty('opacity', '1')
      return
    }
    const reduced = prefersReducedMotion()
    const started: Settles[] = []
    const el = lift.current
    if (canSkeleton && !prerendered && el) started.push(conductor.motion(riseIn(el, delay, reduced)))
    let cancelled = false
    // A frame that has to rise first fills once it is in place; one with no skeleton arrives drawn on its turn.
    const at = delay + (prerendered ? FIRST_FILL : canSkeleton ? FILL_AFTER : 0)
    const fill = gsap.timeline().call(() => !cancelled && !leaving.current && setFilled(true), [], at)
    conductor.timeline(fill)
    started.push({
      complete: () => {
        cancelled = true
        fill.progress(1).kill()
      },
    })
    // A replayed effect (StrictMode) starts from a settled frame and schedules its fill again.
    return () => started.forEach(s => s.complete())
    // The entrance runs once, on mount: the grid remounts the set to replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The fill: data has arrived, so the insides draw in.
  useLayoutEffect(() => {
    if (!filled || gone.current || isStill()) return
    const reduced = prefersReducedMotion()
    const el = lift.current
    if (!canSkeleton && el) entering.current.push(conductor.motion(riseIn(el, 0, reduced)))
    const root = piece.current?.firstElementChild
    if (entry.motion && root instanceof HTMLElement) {
      try {
        const tl = later(canSkeleton ? 0 : INSIDE_DELAY, entry.motion.enter(root, propsFor(entry, 'default'), { reduced }))
        conductor.timeline(tl)
        entering.current.push({ complete: () => tl.progress(1).kill() })
      } catch (error) {
        log.warn('enter failed; the card shows its final state', { component: entry.name, error: (error as Error).message })
      }
    }
    return settleEntering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled])

  // Opening the card, or its Replay, composes the states in it: each panel rises, and the default one draws in.
  useLayoutEffect(() => {
    const key = `${focused}:${replays}`
    if (shownFocus.current === key) return
    shownFocus.current = key
    const el = lift.current
    if (!focused || !el || !filled || still) return
    settleEntering()
    const reduced = prefersReducedMotion()
    el.querySelectorAll('[data-panel]').forEach((panel, i) => entering.current.push(conductor.motion(riseIn(panel, i * STAGGER, reduced))))
    const root = piece.current?.firstElementChild
    if (entry.motion && root instanceof HTMLElement) {
      const tl = later(INSIDE_DELAY, entry.motion.enter(root, propsFor(entry, 'default'), { reduced }))
      conductor.timeline(tl)
      entering.current.push({ complete: () => tl.progress(1).kill() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, replays])

  // Leaving on its own (the filter narrowed the set): the same exit, then the cell is removed.
  useLayoutEffect(() => {
    if (isPresent) return
    void exit(0).finally(() => safeToRemove?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  const onCellClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest(INTERACTIVE)) return
    if (window.getSelection()?.toString()) return
    // An open card closes from its head; its panels and JSON are for reading and selecting.
    if (focused && !target.closest('[data-card-head]')) return
    onToggle(entry.name)
  }

  const schema = entry.spec?.schema
  const keys = schema && 'shape' in schema ? Object.keys((schema as { shape: object }).shape) : []
  const reasons = new Map<string, ComponentState[]>()
  for (const [s, reason] of omitted) reasons.set(reason, [...(reasons.get(reason) ?? []), s])
  const json = JSON.stringify(
    {
      component: entry.name,
      props: entry.sample.props,
      ...(entry.sample.empty ? { empty: entry.sample.empty } : {}),
      ...(entry.sample.error ? { error: entry.sample.error } : {}),
      ...(entry.sample.warming ? { warming: entry.sample.warming } : {}),
    },
    null,
    2,
  )

  return (
    <motion.div
      ref={ref}
      className={styles.cell}
      data-entry={entry.name}
      data-width={entry.width ?? 'half'}
      data-height={heightWord(entry)}
      data-state={state}
      data-focused={focused || undefined}
      layout={media ? false : 'position'}
      transition={{ layout: { duration: MOVES.slide.in, ease: ARRIVE } }}
      onClick={onCellClick}
    >
      <motion.div ref={lift} className={styles.lift} initial={hidden ? { opacity: 0 } : false}>
        <div className={styles.head} data-card-head="">
          <h2 className={styles.title}>
            <button
              type="button"
              className={styles.name}
              data-card-button=""
              aria-expanded={focused}
              aria-controls={focused ? detailsId : undefined}
              onClick={() => onToggle(entry.name)}
            >
              {entry.name}
            </button>
          </h2>
          <span className={styles.data}>{heightWord(entry)}</span>
        </div>
        {focused ? (
          <div id={detailsId} className={styles.details}>
            <p className={styles.when}>{entry.spec?.when ?? entry.description}</p>
            <p className={styles.facts}>
              {keys.length > 0 && <span className={styles.factLabel}>Model sends</span>}
              {keys.map(key => (
                <code key={key} className={styles.data}>
                  {key}
                </code>
              ))}
              {!entry.spec && <code className={styles.data}>a part · never picked</code>}
              {entry.spec && !entry.spec.pickable && <code className={styles.data}>placed by the system · never picked</code>}
            </p>
            <div className={styles.states} data-width={entry.width ?? 'half'}>
              {shownStates(entry).map(s => (
                <figure key={s} className={styles.panel} data-panel="" data-state={s === 'default' ? state : s}>
                  <figcaption className={styles.panelLabel}>{STATE_LABELS[s]}</figcaption>
                  <div ref={s === 'default' ? piece : undefined} className={styles.piece} data-testid={s === 'default' ? 'catalog-piece' : undefined}>
                    <Piece key={s === 'default' ? replays : undefined} entry={entry} state={s === 'default' ? state : s} />
                  </div>
                </figure>
              ))}
            </div>
            {reasons.size > 0 && (
              <ul className={styles.omitted}>
                {[...reasons].map(([reason, states]) => (
                  <li key={reason}>
                    {states.map(s => STATE_LABELS[s]).join(' · ')} {states.length === 1 ? 'is' : 'are'} left out · {reason}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.pill} onClick={() => setReplays(r => r + 1)} disabled={!filled && !still}>
                Replay
              </button>
              <button type="button" className={styles.pill} aria-expanded={showJson} onClick={() => setShowJson(v => !v)}>
                {showJson ? 'Hide JSON' : 'View JSON'}
              </button>
              <span className={styles.data}>
                {entry.sampleFile} · {json.split('\n').length} lines
              </span>
            </div>
            {showJson && (
              <pre className={styles.json} data-testid="catalog-json">
                <code>{json}</code>
              </pre>
            )}
          </div>
        ) : (
          <div ref={piece} className={styles.piece}>
            <Piece entry={entry} state={state} />
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
