'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, useReducedMotion } from 'motion/react'
import { StateRow, TextLink, type Density } from '@genui-github/ui'
import { wipe } from '@genui-github/ui/motion'
import { plan as makePlan, type Plan } from '../choreography'
import { diff } from '../diff'
import type { Composition, RegionName } from '../format'
import { toScreen } from '../screen'
import type { StreamTree } from '../stream'
import type { RenderNode, Screen } from '../validate'
import { Conductor } from './conductor'
import { PieceFrame, StageContext, type RendererHandlers, type Stage } from './PieceFrame'
import styles from './Renderer.module.css'

export interface RendererProps extends RendererHandlers {
  /** A finished composition. */
  composition?: Composition
  /** Or the tree a stream has built so far; it wins over `composition`. */
  tree?: StreamTree
  /** The question in the header. It wipes out and in when it changes. */
  question?: string
  /** The reader's density, over the composer's default. */
  density?: Density
  /** Overrides the media query; tests and the catalog use it. */
  reduced?: boolean
}

/** The system's words when the whole composition failed. */
export const COMPOSITION_FAILED = "Couldn't write an answer to this question."

const EMPTY_PLAN: Plan = { mode: 'initial', cues: new Map() }

interface Memo {
  source?: Composition | StreamTree
  screen?: Screen
  plan: Plan
}

function build(prev: Memo | undefined, source: Composition | StreamTree | undefined): Memo {
  const screen = source ? toScreen(source) : undefined
  return { source, screen, plan: screen ? makePlan(diff(prev?.screen, screen)) : EMPTY_PLAN }
}

/** Starts each screen change before any piece registers its moves: it renders first, so its effect runs first. */
function Clock({ plan, conductor }: { plan: Plan; conductor: Conductor }) {
  useLayoutEffect(() => {
    conductor.begin()
  }, [plan, conductor])
  return null
}

function QuestionLine({ text, conductor, reduced }: { text: string; conductor: Conductor; reduced: boolean }) {
  const [shown, setShown] = useState(text)
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || text === shown) return
    conductor.timeline(wipe(el, { direction: 'out', reduced }), conductor.generation, () => setShown(text))
  }, [text, shown, conductor, reduced])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tl = conductor.timeline(wipe(el, { reduced }), conductor.generation, undefined, 'question')
    return () => {
      tl.progress(1)
    }
  }, [shown, conductor, reduced])

  return (
    <h1 ref={ref} className={styles.question} data-question="">
      {shown}
    </h1>
  )
}

function Region({ name, nodes, label }: { name: RegionName; nodes: RenderNode[]; label?: string }) {
  return (
    <section className={styles[name]} data-region={name} data-count={nodes.length} aria-label={label}>
      <AnimatePresence mode="popLayout">
        {nodes.map(node => (
          <PieceFrame key={node.id} node={node} />
        ))}
      </AnimatePresence>
    </section>
  )
}

/**
 * A composition to React. Pieces are keyed by stable id, so a survivor of a rewrite morphs in place and
 * is never remounted; leaving pieces stay mounted until their exit has run.
 */
export function Renderer({ composition, tree, question, density, reduced: reducedOverride, ...handlers }: RendererProps) {
  const source = tree ?? composition
  const media = useReducedMotion()
  const reduced = reducedOverride ?? media ?? false
  const [phase, setPhase] = useState<'composing' | 'settled'>('composing')
  const [conductor] = useState(() => new Conductor({ onPhase: setPhase }))
  const [memo, setMemo] = useState<Memo>(() => build(undefined, source))
  let current = memo
  // Keyed on the source, not on a derived object, so a second render pass reuses the plan instead of diffing a screen against itself.
  if (memo.source !== source) {
    current = build(memo, source)
    setMemo(current)
  }
  const { screen, plan } = current

  useLayoutEffect(() => () => conductor.dispose(), [conductor])

  if (!screen) return null
  const stage: Stage = { plan, conductor, reduced, handlers }
  const { regions } = screen
  const sideless = regions.side.length === 0

  return (
    <StageContext.Provider value={stage}>
      <div
        className={styles.screen}
        data-density={density ?? screen.density}
        data-composition={screen.id}
        data-phase={phase}
      >
        <Clock plan={plan} conductor={conductor} />
        {question !== undefined && <QuestionLine text={question} conductor={conductor} reduced={reduced} />}
        <LayoutGroup>
          {screen.error ? (
            <section className={styles.insight} data-region="insight" aria-label="Answer">
              <StateRow
                kind="error"
                title={COMPOSITION_FAILED}
                meta={screen.error}
                action={handlers.onRetry ? <TextLink onClick={() => handlers.onRetry!({ from: screen.id })}>Try again</TextLink> : undefined}
              />
            </section>
          ) : (
            <Region name="insight" nodes={regions.insight} label="Answer" />
          )}
          <Region name="metrics" nodes={regions.metrics} label="Key numbers" />
          <div className={styles.split} data-columns={sideless ? 1 : 2}>
            <Region name="main" nodes={regions.main} />
            <Region name="side" nodes={regions.side} />
          </div>
          <Region name="action" nodes={regions.action} />
        </LayoutGroup>
      </div>
    </StageContext.Provider>
  )
}
