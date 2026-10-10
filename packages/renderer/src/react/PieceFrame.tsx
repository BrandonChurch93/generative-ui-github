'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { animate, motion, usePresence } from 'motion/react'
import { PIECES, type PieceDefinition } from '@genui-github/ui/pieces'
import { bloom, MOVES, REDUCED } from '@genui-github/ui/motion'
import type { Plan } from '../choreography'
import type { RenderNode } from '../validate'
import type { Conductor, MotionHandle } from './conductor'
import { NO_CARD, PieceBody } from './PieceBody'
import { PieceError } from './PieceError'
import styles from './Renderer.module.css'

/** What the host hears. `from` is the stable id of the piece the reader acted on. */
export interface AskEvent {
  ask: string
  from: string
}

export interface RendererHandlers {
  onAsk?: (event: AskEvent) => void
  onRetry?: (event: { from: string }) => void
  onOpenDrawer?: (event: { from: string; content: { title: string; items: string[] } }) => void
  onSubmit?: (event: { from: string; values: unknown }) => void
  onFilter?: (event: { from: string; selected: string[] }) => void
}

export interface Stage {
  plan: Plan
  conductor: Conductor
  reduced: boolean
  handlers: RendererHandlers
  /** A piece's leave has finished: it is out of sight, still mounted, until the next answer arrives. */
  onLeft?: (id: string, leave: number) => void
}

interface Leaving {
  done: Promise<void>
  sink?: MotionHandle
  cancelled: boolean
}

export const StageContext = createContext<Stage | null>(null)

// Motion takes cubic-bezier arrays; these are motion.md's house curve and its exit.
const ARRIVE = [0.25, 1, 0.5, 1] as const
const EXIT = [0.55, 0.085, 0.68, 0.53] as const
/** The card sinks once its insides are half gone, or after this long, whichever comes first, so it clears its spot for the next. */
const SINK_AFTER = 0.25
/** ActionCard blooms itself on arrival; every other card gets the bloom when the model raises its emphasis. */
const SELF_BLOOM = new Set(['ActionCard'])

/** Callbacks a component takes beyond PieceRenderProps travel in its props; the renderer wires them to the host. */
function inject(node: RenderNode, handlers: RendererHandlers): unknown {
  const props = node.props as Record<string, unknown>
  if (node.component === 'Form' && handlers.onSubmit) return { ...props, onSubmit: (values: unknown) => handlers.onSubmit!({ from: node.id, values }) }
  if (node.component === 'FilterChips' && handlers.onFilter) return { ...props, onChange: (selected: string[]) => handlers.onFilter!({ from: node.id, selected }) }
  return props
}

function renderPiece(node: RenderNode, def: PieceDefinition | undefined, handlers: RendererHandlers) {
  if (node.unknown || !def) return <PieceError node={node} />
  const from = node.id
  const { Component } = def
  return (
    <Component
      props={inject(node, handlers)}
      state={node.state}
      error={node.error}
      warming={node.warming}
      tone={node.tone}
      emphasis={node.emphasis}
      ask={node.ask}
      onAsk={handlers.onAsk ? ask => handlers.onAsk!({ ask, from }) : undefined}
      onRetry={handlers.onRetry ? () => handlers.onRetry!({ from }) : undefined}
      onOpenDrawer={handlers.onOpenDrawer ? content => handlers.onOpenDrawer!({ from, content }) : undefined}
    />
  )
}

/**
 * The wrapper around one piece, which Motion owns: the rise in, the sink out, and the layout move when a
 * survivor changes place. AnimatePresence keeps a leaving piece mounted until its exit has finished.
 */
export function PieceFrame({ node, ref }: { node: RenderNode; ref?: Ref<HTMLDivElement> }) {
  const stage = useContext(StageContext)
  if (!stage) throw new Error('PieceFrame renders only inside the Renderer')
  const { plan, conductor, reduced, handlers, onLeft } = stage
  const [isPresent, safeToRemove] = usePresence()
  const leaving = useRef<Leaving | null>(null)
  const [left, setLeft] = useState(false)
  const body = useRef<PieceBody>(null)
  const warmth = useRef<HTMLSpanElement>(null)
  const emphasis = useRef(node.emphasis)
  const def = PIECES[node.component]
  const card = !NO_CARD.has(node.component)
  const [initial] = useState(() =>
    plan.cues.get(node.id)?.action === 'enter' && card ? (reduced ? { opacity: 0 } : { opacity: 0, y: MOVES.rise.distance }) : false,
  )

  /** The insides run their exit, then the card sinks once they are half gone. Resolves when both are done. */
  const startExit = (at: number): Omit<Leaving, 'cancelled'> => {
    const el = body.current?.wrapper()
    let innerDone!: () => void
    const waits: Promise<unknown>[] = [new Promise<void>(resolve => (innerDone = resolve))]
    const inner = body.current ? body.current.exit(at, innerDone) : (innerDone(), undefined)
    let sink: MotionHandle | undefined
    if (card && el) {
      const keyframes = reduced ? { opacity: 0 } : { opacity: 0, y: MOVES.rise.distance }
      const delay = at + Math.min((inner?.duration() ?? 0) / 2, SINK_AFTER)
      const transition = reduced ? { duration: REDUCED.duration, ease: 'linear' as const, delay } : { duration: MOVES.rise.out, ease: EXIT, delay }
      sink = conductor.motion(animate(el, keyframes, transition))
      waits.push(sink.finished)
    }
    return { done: Promise.all(waits).then(() => undefined), sink }
  }

  useLayoutEffect(() => {
    if (!isPresent) return
    const cue = plan.cues.get(node.id)
    const el = body.current?.wrapper()
    if (!cue || !el) return
    if (cue.action === 'leave') {
      if (leaving.current) return
      const token = plan.leave ?? 0
      const leave: Leaving = { ...startExit(cue.at), cancelled: false }
      leaving.current = leave
      void leave.done.then(() => {
        if (leave.cancelled) return
        setLeft(true)
        onLeft?.(node.id, token)
      })
      return
    }
    const started: { complete(): void }[] = []
    const back = leaving.current
    if (back) {
      // The next answer keeps this piece: it takes back its place instead of finishing the leave.
      leaving.current = null
      back.cancelled = true
      back.sink?.cancel()
      setLeft(false)
      if (card && cue.action !== 'enter') {
        const transition = reduced ? { duration: REDUCED.duration, ease: 'linear' as const } : { duration: MOVES.rise.in, ease: ARRIVE }
        started.push(conductor.motion(animate(el, reduced ? { opacity: 1 } : { opacity: 1, y: 0 }, transition)))
      }
    }
    if (cue.action === 'enter' && card) {
      const keyframes = reduced ? { opacity: [0, 1] } : { opacity: [0, 1], y: [MOVES.rise.distance, 0] }
      const transition = reduced ? { duration: REDUCED.duration, ease: 'linear' as const, delay: cue.at } : { duration: MOVES.rise.in, ease: ARRIVE, delay: cue.at }
      started.push(conductor.motion(animate(el, keyframes, transition), conductor.generation, undefined, `${node.id}:rise`))
    }
    const raised = node.emphasis === 'high' && (cue.action === 'enter' || (cue.action === 'morph' && emphasis.current !== 'high'))
    if (raised && warmth.current) {
      const tl = conductor.timeline(bloom(warmth.current, { delay: cue.at, reduced }))
      started.push({ complete: () => tl.progress(1) })
    }
    emphasis.current = node.emphasis
    // A replayed effect (StrictMode, a fast rewrite) starts from a settled card, never from half a rise.
    return () => started.forEach(a => a.complete())
    // startExit is rebuilt every render and onLeft never changes; rerunning on either would restart a leave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, isPresent, node.id, node.emphasis, card, reduced, conductor])

  useLayoutEffect(() => {
    if (isPresent) return
    const cue = plan.cues.get(node.id)
    // A piece that was already leaving finishes that leave; it never runs its exit twice. Kept as a leave, so a
    // piece the next composition brings back before its exit ends takes back its place.
    const leave = leaving.current ?? { ...startExit(cue?.action === 'exit' ? cue.at : 0), cancelled: false }
    leaving.current = leave
    void leave.done.finally(() => {
      if (!leave.cancelled) safeToRemove?.()
    })
    // Only the change of presence starts an exit; the plan it reads is the one that removed the piece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent])

  return (
    <motion.div
      ref={ref}
      className={styles.piece}
      data-piece-id={node.id}
      data-component={node.component}
      data-state={node.state}
      data-emphasis={node.emphasis}
      data-left={left || undefined}
      inert={left || undefined}
      aria-hidden={left || undefined}
      initial={initial}
      layout={reduced ? false : 'position'}
      transition={{ layout: { duration: MOVES.slide.in, ease: ARRIVE } }}
    >
      {card && !SELF_BLOOM.has(node.component) && <span ref={warmth} className={styles.warmth} aria-hidden="true" />}
      <PieceBody ref={body} node={node} def={def} plan={plan} conductor={conductor} reduced={reduced} render={() => renderPiece(node, def, handlers)} />
    </motion.div>
  )
}
