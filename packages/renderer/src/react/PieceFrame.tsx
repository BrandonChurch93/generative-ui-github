'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { animate, motion, usePresence } from 'motion/react'
import { PIECES, type PieceDefinition } from '@genui-github/ui/pieces'
import { bloom, MOVES, REDUCED } from '@genui-github/ui/motion'
import type { Plan } from '../choreography'
import type { RenderNode } from '../validate'
import type { Conductor } from './conductor'
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
  const { plan, conductor, reduced, handlers } = stage
  const [isPresent, safeToRemove] = usePresence()
  const body = useRef<PieceBody>(null)
  const warmth = useRef<HTMLSpanElement>(null)
  const emphasis = useRef(node.emphasis)
  const def = PIECES[node.component]
  const card = !NO_CARD.has(node.component)
  const [initial] = useState(() =>
    plan.cues.get(node.id)?.action === 'enter' && card ? (reduced ? { opacity: 0 } : { opacity: 0, y: MOVES.rise.distance }) : false,
  )

  useLayoutEffect(() => {
    if (!isPresent) return
    const cue = plan.cues.get(node.id)
    const el = body.current?.wrapper()
    if (!cue || !el) return
    const started: { complete(): void }[] = []
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
  }, [plan, isPresent, node.id, node.emphasis, card, reduced, conductor])

  useLayoutEffect(() => {
    if (isPresent) return
    const el = body.current?.wrapper()
    const cue = plan.cues.get(node.id)
    const at = cue?.action === 'exit' ? cue.at : 0
    let innerDone!: () => void
    const waits: Promise<unknown>[] = [new Promise<void>(resolve => (innerDone = resolve))]
    const inner = body.current ? body.current.exit(at, innerDone) : (innerDone(), undefined)
    if (card && el) {
      const keyframes = reduced ? { opacity: 0 } : { opacity: 0, y: MOVES.rise.distance }
      const delay = at + Math.min((inner?.duration() ?? 0) / 2, SINK_AFTER)
      const transition = reduced ? { duration: REDUCED.duration, ease: 'linear' as const, delay } : { duration: MOVES.rise.out, ease: EXIT, delay }
      waits.push(conductor.motion(animate(el, keyframes, transition)).finished)
    }
    void Promise.all(waits).finally(() => safeToRemove?.())
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
      initial={initial}
      layout={reduced ? false : 'position'}
      transition={{ layout: { duration: MOVES.slide.in, ease: ARRIVE } }}
    >
      {card && !SELF_BLOOM.has(node.component) && <span ref={warmth} className={styles.warmth} aria-hidden="true" />}
      <PieceBody ref={body} node={node} def={def} plan={plan} conductor={conductor} reduced={reduced} render={() => renderPiece(node, def, handlers)} />
    </motion.div>
  )
}
