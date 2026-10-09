'use client'

import { Component, createRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { createLogger } from '@genui-github/core'
import type { PieceDefinition } from '@genui-github/ui/pieces'
import { fade, MOVES, REDUCED } from '@genui-github/ui/motion'
import type { Cue, Plan } from '../choreography'
import { INSIDE_DELAY } from '../choreography'
import type { RenderNode } from '../validate'
import type { Conductor } from './conductor'
import { PieceError } from './PieceError'

const log = createLogger('renderer:piece')

/**
 * Starts a component's choreography after `delay`. The delay is never handed to the component: its
 * timelines pass their options on to the primitives, which would apply it a second time.
 */
function later(delay: number, tl: gsap.core.Timeline): gsap.core.Timeline {
  return delay > 0 ? gsap.timeline({ delay }).add(tl, 0) : tl
}

/** Pieces with no card around them: the insight is a sentence, and WarmingUp runs its own rise inside enter. */
export const NO_CARD = new Set(['Insight', 'WarmingUp'])

export interface PieceBodyProps {
  node: RenderNode
  def: PieceDefinition | undefined
  plan: Plan
  conductor: Conductor
  reduced: boolean
  render: () => ReactNode
}

interface Snapshot {
  captured: unknown
}

/** Catches a component that throws on what it was given, and shows the piece's error instead. */
class PieceBoundary extends Component<{ node: RenderNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error) {
    log.error('piece threw while rendering', { id: this.props.node.id, component: this.props.node.component, error: error.message })
  }

  override componentDidUpdate(prev: { node: RenderNode }) {
    if (this.state.failed && prev.node !== this.props.node) this.setState({ failed: false })
  }

  override render() {
    return this.state.failed ? <PieceError node={this.props.node} /> : this.props.children
  }
}

/**
 * The inside of a piece, and the GSAP half of its choreography. A class, because a survivor's Flip needs
 * where its rows were before React commits the new props (getSnapshotBeforeUpdate), and nothing else gives that.
 */
export class PieceBody extends Component<PieceBodyProps> {
  private ref = createRef<HTMLDivElement>()

  /** The component's own root, which every `motion.ts` takes. */
  root(): HTMLElement | null {
    const el = this.ref.current?.firstElementChild
    return el instanceof HTMLElement ? el : null
  }

  /** The Motion wrapper around this body: the element the frame rises and sinks. */
  wrapper(): HTMLElement | null {
    return this.ref.current?.parentElement ?? null
  }

  private cue(): Cue | undefined {
    return this.props.plan.cues.get(this.props.node.id)
  }

  private moves(): boolean {
    return this.props.def !== undefined && !this.props.node.unknown
  }

  private run(make: () => gsap.core.Timeline | undefined, onDone?: (generation: number) => void): gsap.core.Timeline | undefined {
    const { conductor } = this.props
    const generation = conductor.generation
    const done = () => onDone?.(generation)
    try {
      const tl = make()
      if (tl) conductor.timeline(tl, generation, done, this.props.node.id)
      else done()
      return tl
    } catch (error) {
      log.warn('piece motion failed; the piece shows its final state', { id: this.props.node.id, error: (error as Error).message })
      done()
      return undefined
    }
  }

  enter(cue: Cue) {
    const root = this.root()
    const { node, def, reduced } = this.props
    if (!root || !this.moves() || node.state !== 'default') return
    const delay = cue.at + (NO_CARD.has(node.component) ? 0 : INSIDE_DELAY)
    this.run(() => later(delay, def!.motion.enter(root, node.props, { reduced })))
    this.markInsight(delay)
  }

  /** The answer is readable once its sentence has wiped in, whatever its rule is still drawing. */
  private markInsight(delay: number) {
    if (this.props.node.component !== 'Insight') return
    const { conductor, reduced } = this.props
    const generation = conductor.generation
    this.run(() => gsap.timeline({ delay }).call(() => conductor.insightVisible(generation), [], reduced ? REDUCED.duration : MOVES.wipe.in))
  }

  /** The strict reverse of enter. The wrapper sinks after it. */
  exit(at: number, onDone: () => void): gsap.core.Timeline | undefined {
    const root = this.root()
    const { node, def, reduced } = this.props
    if (!root || !this.moves() || node.state !== 'default') {
      onDone()
      return undefined
    }
    return this.run(() => later(at, def!.motion.exit(root, node.props, { reduced })), onDone)
  }

  override componentDidMount() {
    const cue = this.cue()
    if (cue?.action === 'enter') this.enter(cue)
  }

  override getSnapshotBeforeUpdate(prev: PieceBodyProps): Snapshot | null {
    if (prev.plan === this.props.plan) return null
    const cue = this.cue()
    const root = this.root()
    if (!root || !cue || (cue.action !== 'morph' && cue.action !== 'update') || !this.moves()) return null
    try {
      return { captured: this.props.def!.motion.capture?.(root) }
    } catch (error) {
      log.warn('piece capture failed; it moves without Flip', { id: this.props.node.id, error: (error as Error).message })
      return { captured: undefined }
    }
  }

  override componentDidUpdate(prev: PieceBodyProps, _state: unknown, snapshot: Snapshot | null) {
    if (prev.plan === this.props.plan) return
    const cue = this.cue()
    if (!cue) return
    if (cue.action === 'enter') return this.enter(cue)
    if (cue.action !== 'morph' && cue.action !== 'update') return
    const root = this.root()
    const { node, def, reduced } = this.props
    if (!root || !this.moves()) return
    const [was, now] = [prev.node.state, node.state]
    // Data that has just arrived draws in; a change between two drawn states morphs; anything else fades.
    if (was !== 'default' && now === 'default') return this.enter(cue)
    if (was !== 'default' || now !== 'default') {
      this.run(() => fade(root))
      return
    }
    this.run(() => {
      const options = { reduced, captured: snapshot?.captured }
      const inner = cue.action === 'update' ? def!.motion.update(root, prev.node.props, node.props, options) : def!.motion.morph(root, prev.node.props, node.props, options)
      return later(cue.at, inner)
    })
    this.markInsight(cue.at)
  }

  override render() {
    return (
      <div ref={this.ref} data-piece-body="">
        <PieceBoundary node={this.props.node}>{this.props.render()}</PieceBoundary>
      </div>
    )
  }
}
