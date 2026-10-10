'use client'

import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, useReducedMotion } from 'motion/react'
import { createLogger } from '@genui-github/core'
import { StateRow, TextLink, type Density } from '@genui-github/ui'
import { wipe } from '@genui-github/ui/motion'
import { EXIT_LEAD, leave as leavePlan, plan as makePlan, type Plan } from '../choreography'
import { diff } from '../diff'
import { REGION_NAMES, type Composition, type RegionName } from '../format'
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
  /**
   * A new answer has been asked for and has not begun to arrive. The current pieces leave at once; whatever
   * arrives in time takes over as a rewrite, and if nothing has once the old answer is gone, the answer's
   * frame waits as a skeleton.
   */
  awaiting?: boolean
  /** The id of the piece the reader clicked to ask: it stays while the rest leave. */
  anchor?: string
}

/** The system's words when the whole composition failed. */
export const COMPOSITION_FAILED = "Couldn't write an answer to this question."

const EMPTY_PLAN: Plan = { mode: 'initial', cues: new Map() }

/** The id the screen carries while an answer is awaited, so nothing reads the leaving answer as the current one. */
const AWAITING = 'awaiting'

interface Leave {
  /** The answer as it stood when the question was asked. */
  from: Screen
  /** `performance.now()` when its exits began; also the leave's token. */
  started: number
  anchor?: string
  /** The answer's own frame, shown as a skeleton once the old insight has gone and nothing has arrived. */
  placeholder?: RenderNode
  /** Pieces whose exit has finished: out of sight, still mounted, so a piece the answer keeps comes back in place. */
  left: ReadonlySet<string>
}

interface Memo {
  source?: Composition | StreamTree
  screen?: Screen
  plan: Plan
  awaiting: boolean
  leave?: Leave
  /** React keys for pieces that took over a skeleton frame, so the frame fills instead of being replaced. */
  keys: ReadonlyMap<string, string>
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

const noRegions = (): Screen['regions'] => ({ insight: [], metrics: [], main: [], side: [], action: [] })
const empty = (like: Screen): Screen => ({ ...like, id: AWAITING, regions: noRegions(), error: undefined })

const nodesOf = (screen: Screen | undefined) => (screen ? REGION_NAMES.flatMap(r => screen.regions[r]) : [])

/** Ids that keep their React key into the next screen. */
function keysFor(screen: Screen | undefined, keys: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const ids = new Set(nodesOf(screen).map(n => n.id))
  return new Map([...keys].filter(([id]) => ids.has(id)))
}

function build(prev: Memo | undefined, source: Composition | StreamTree | undefined, awaiting: boolean): Memo {
  const screen = source ? toScreen(source) : undefined
  return { source, screen, plan: screen ? makePlan(diff(prev?.screen, screen)) : EMPTY_PLAN, awaiting, keys: keysFor(screen, prev?.keys ?? new Map()) }
}

/** The question was asked: every piece but the one clicked starts its exit, and stays mounted while it runs. */
function depart(memo: Memo, anchor: string | undefined): Memo {
  const blank: Screen = { id: AWAITING, density: 'comfortable', asks: [], regions: noRegions(), final: false }
  const from = memo.screen ? { ...memo.screen, error: undefined } : blank
  const started = now()
  const kept = anchor && nodesOf(from).some(n => n.id === anchor) ? anchor : undefined
  return {
    ...memo,
    screen: { ...from, id: AWAITING },
    plan: leavePlan(diff(from, empty(from)), { anchor: kept, token: started }),
    awaiting: true,
    leave: { from, started, anchor: kept, left: new Set() },
  }
}

/**
 * Nothing has arrived by the time a rewrite's first entrance would begin, and the old insight has gone: the
 * answer's frame mounts as a skeleton in its place. Only the insight, since every answer has exactly one and
 * nothing else about the next answer is known yet.
 */
function placehold(memo: Memo): Memo {
  const { leave, screen } = memo
  if (!leave || leave.placeholder || !screen) return memo
  const { left } = leave
  if ((now() - leave.started) / 1000 < EXIT_LEAD) return memo
  if (!screen.regions.insight.every(n => left.has(n.id))) return memo
  const placeholder: RenderNode = { id: `insight:pending:${Math.round(leave.started)}`, region: 'insight', component: 'Insight', props: {}, state: 'skeleton' }
  const cues = new Map(memo.plan.cues)
  cues.set(placeholder.id, { action: 'enter', at: 0 })
  return {
    ...memo,
    screen: { ...screen, regions: { ...screen.regions, insight: [placeholder] } },
    plan: { mode: 'rewrite', cues, carry: true, leave: leave.started },
    leave: { ...leave, placeholder },
  }
}

/** The new answer began to arrive during a leave: a rewrite from what is still in sight, on the clock the click started. */
function arrive(memo: Memo, source: Composition | StreamTree, awaiting: boolean): Memo {
  const leave = memo.leave!
  const { left } = leave
  const next = toScreen(source)
  const showing = (id: string) => !left.has(id) && id !== leave.placeholder?.id
  const regions = Object.fromEntries(REGION_NAMES.map(r => [r, (memo.screen?.regions[r] ?? []).filter(n => showing(n.id))])) as Screen['regions']
  const prev: Screen = { ...leave.from, regions }
  const plan = makePlan({ ...diff(prev, next), mode: 'rewrite' }, { since: (now() - leave.started) / 1000 })
  const keys = new Map(keysFor(next, memo.keys))
  const insight = next.regions.insight[0]
  if (leave.placeholder && insight && !nodesOf(memo.screen).some(n => n.id === insight.id)) keys.set(insight.id, leave.placeholder.id)
  return { source, screen: next, plan: { ...plan, leave: leave.started }, awaiting, keys }
}

/** A stream that has opened but sent no piece yet has nothing to rewrite with; the leave goes on. */
const hasContent = (source: Composition | StreamTree) =>
  !('done' in source) || source.done || Boolean(source.error) || REGION_NAMES.some(r => source.regions[r].length > 0)

/** Starts each screen change before any piece registers its moves: it renders first, so its effect runs first. */
function Clock({ plan, conductor }: { plan: Plan; conductor: Conductor }) {
  useLayoutEffect(() => {
    conductor.begin(plan.carry)
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

const log = createLogger('renderer:region')

/** The system's words when a whole region failed to draw. */
export const REGION_FAILED = "Couldn't draw this part of the answer"

/**
 * A piece's own boundary catches a component that throws while rendering. This one catches what is left:
 * a frame or a move that throws, so one region failing never takes the screen with it.
 */
class RegionBoundary extends Component<{ name: RegionName; ids: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error) {
    log.error('region threw while rendering', { region: this.props.name, error: error.message })
  }

  override componentDidUpdate(prev: { ids: string }) {
    // A new composition in this region gets a fresh try.
    if (this.state.failed && prev.ids !== this.props.ids) this.setState({ failed: false })
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return <StateRow kind="error" title={REGION_FAILED} meta="A part of the renderer failed on this data" />
  }
}

function Region({ name, nodes, label, keys }: { name: RegionName; nodes: RenderNode[]; label?: string; keys: ReadonlyMap<string, string> }) {
  return (
    <section className={styles[name]} data-region={name} data-count={nodes.length} aria-label={label}>
      <RegionBoundary name={name} ids={nodes.map(n => n.id).join(' ')}>
        <AnimatePresence mode="popLayout">
          {nodes.map(node => (
            <PieceFrame key={keys.get(node.id) ?? node.id} node={node} />
          ))}
        </AnimatePresence>
      </RegionBoundary>
    </section>
  )
}

/**
 * A composition to React. Pieces are keyed by stable id, so a survivor of a rewrite morphs in place and
 * is never remounted; leaving pieces stay mounted until their exit has run.
 */
export function Renderer({ composition, tree, question, density, reduced: reducedOverride, awaiting: awaitingProp, anchor, ...handlers }: RendererProps) {
  const source = tree ?? composition
  const awaiting = Boolean(awaitingProp)
  const media = useReducedMotion()
  const reduced = reducedOverride ?? media ?? false
  const [phase, setPhase] = useState<'composing' | 'settled'>('composing')
  const [conductor] = useState(() => new Conductor({ onPhase: setPhase }))
  // Mounting while an answer is awaited (a retry after a refusal) shows nothing of the last one.
  const [memo, setMemo] = useState<Memo>(() => (awaiting ? depart({ source, plan: EMPTY_PLAN, awaiting: false, keys: new Map() }, undefined) : build(undefined, source, false)))
  let current = memo
  // Keyed on the source, not on a derived object, so a second render pass reuses the plan instead of diffing a screen against itself.
  if (memo.source !== source) {
    if (!memo.leave) current = build(memo, source, awaiting)
    else if (source && hasContent(source)) current = arrive(memo, source, awaiting)
    else current = { ...memo, source }
  } else if (awaiting && !memo.awaiting && !memo.leave) {
    current = depart(memo, anchor)
  }
  if (current.awaiting !== awaiting) current = { ...current, awaiting }
  if (current !== memo) setMemo(current)
  const { screen, plan, keys } = current
  const leave = current.leave

  useLayoutEffect(() => () => conductor.dispose(), [conductor])

  // The skeleton waits for a rewrite's first entrance beat; the old insight going is reported by onLeft.
  useEffect(() => {
    if (!leave || leave.placeholder) return
    const wait = Math.max(0, EXIT_LEAD * 1000 - (now() - leave.started))
    const timer = setTimeout(() => setMemo(m => (m.leave === leave ? placehold(m) : m)), wait)
    return () => clearTimeout(timer)
  }, [leave])

  const onLeft = useCallback((id: string, token: number) => {
    setMemo(m => (m.leave?.started === token ? placehold({ ...m, leave: { ...m.leave, left: new Set([...m.leave.left, id]) } }) : m))
  }, [])

  if (!screen) return null
  const stage: Stage = { plan, conductor, reduced, handlers, onLeft }
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
            <Region name="insight" nodes={regions.insight} label="Answer" keys={keys} />
          )}
          <Region name="metrics" nodes={regions.metrics} label="Key numbers" keys={keys} />
          <div className={styles.split} data-columns={sideless ? 1 : 2}>
            <Region name="main" nodes={regions.main} keys={keys} />
            <Region name="side" nodes={regions.side} keys={keys} />
          </div>
          <Region name="action" nodes={regions.action} keys={keys} />
        </LayoutGroup>
      </div>
    </StageContext.Provider>
  )
}
