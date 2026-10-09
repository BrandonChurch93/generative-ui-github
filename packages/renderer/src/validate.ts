import { createLogger } from '@genui-github/core'
import {
  NUMBER_MISMATCH_SENTENCE,
  registry as defaultRegistry,
  validateNumbers,
  type ComponentState,
  type Emphasis,
  type ErrorInfo,
  type Registry,
  type Tone,
  type WarmingInfo,
} from '@genui-github/ui'
import { REGION_NAMES, emptyRegions, type WarnLog, type Ask, type Built, type Density, type Piece, type RegionName, type Regions } from './format'

// The validation pipeline from docs/schemas.md, shared with the composer. Nothing here throws on bad model
// output: a bad piece becomes an error piece with a logged reason, and the rest of the screen renders.

/** Components the system places that the model never picks. */
export const SYSTEM_COMPONENTS = new Set(['EmptyState', 'WarmingUp'])

/** One piece, ready to render: what the component receives, plus where it sits. */
export interface RenderNode {
  id: string
  region: RegionName
  component: string
  /** The bound props, after prose that failed number validation was replaced. */
  props: unknown
  state: ComponentState
  error?: ErrorInfo
  warming?: WarmingInfo
  ask?: string
  emphasis?: Emphasis
  tone?: Tone
  /** True when the registry did not know the component: there is no error state of its own to render. */
  unknown?: boolean
}

export interface Screen {
  id: string
  density: Density
  asks: Ask[]
  regions: Record<RegionName, RenderNode[]>
  built?: Built
  /** The composition failed as a whole; the renderer shows the system error sentence. */
  error?: string
  /** `done` arrived: a piece still without data is now an error, not a skeleton. */
  final: boolean
}

export interface ValidateOptions {
  registry?: Registry
  log?: WarnLog
  final?: boolean
  /**
   * True for a composition the model composed freely. The golden templates set grows pieces side by side on
   * purpose (a timeline beside the people in it), so only a free composition is held to rule 4's grows pair.
   */
  free?: boolean
}

const defaultLog = createLogger('renderer:validate')

/** The system's words for a piece that could not be shown. Never crit, never an apology. */
export const PIECE_ERRORS = {
  unknown: (component: string): ErrorInfo => ({ failed: "Couldn't show this card", cause: `${component} is not a component this screen knows` }),
  props: (component: string): ErrorInfo => ({ failed: `Couldn't show ${component}`, cause: 'The composer sent a description that failed validation' }),
  data: (component: string): ErrorInfo => ({ failed: `Couldn't show ${component}`, cause: 'Its data never arrived' }),
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type ProseCheck = (bound: Record<string, unknown>, cites: number[]) => { field: string; text: string; allowed: number[]; replace: (b: Record<string, unknown>) => Record<string, unknown> }[]

const numbersIn = (value: unknown): number[] => (typeof value === 'number' ? [value] : typeof value === 'string' ? [...value.matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0])) : [])

/**
 * Prose the renderer checks itself. LineChart, BarChart, Comparison, Heatmap and Callout check their own
 * findings against the series they draw, and fall back to the system's summary inside the component.
 */
const PROSE: Record<string, ProseCheck> = {
  Insight(bound, cites) {
    if (typeof bound.sentence !== 'string' || !isRecord(bound.sourceMap)) return []
    const map = bound.sourceMap as Record<string, { numbers?: number[] }>
    const sources = Array.isArray(bound.sources) ? (bound.sources as { key?: string }[]) : []
    const allowed = [...sources.flatMap(s => (s.key ? (map[s.key]?.numbers ?? []) : [])), ...cites]
    return [{ field: 'sentence', text: bound.sentence, allowed, replace: b => ({ ...b, sentence: NUMBER_MISMATCH_SENTENCE }) }]
  },
  Metric(bound, cites) {
    if (typeof bound.delta !== 'string') return []
    const allowed = [...numbersIn(bound.value), ...numbersIn(bound.suffix), ...cites]
    // A delta has no room for the system sentence; it gives way to the window in words.
    return [{ field: 'delta', text: bound.delta, allowed, replace: ({ delta: _delta, ...b }) => b }]
  },
  ActionCard(bound, cites) {
    const effect = isRecord(bound.effect) ? bound.effect : {}
    const allowed = [Array.isArray(effect.targets) ? effect.targets.length : 0, ...cites]
    return (['heading', 'body'] as const)
      .filter(f => typeof bound[f] === 'string')
      .map(field => ({ field, text: bound[field] as string, allowed, replace: b => ({ ...b, [field]: field === 'heading' ? 'A next step' : "The model's figure didn't match the data, so its words are left out." }) }))
  },
}

function checkProse(piece: Piece, bound: unknown, log: WarnLog): unknown {
  const check = PROSE[piece.component]
  if (!check || !isRecord(bound)) return bound
  let out = bound
  for (const slot of check(bound, piece.cites ?? [])) {
    const result = validateNumbers(slot.text, slot.allowed)
    if (result.ok) continue
    log.warn('prose number did not match the cited data', { id: piece.id, field: slot.field, mismatches: result.mismatches.map(m => m.raw) })
    out = slot.replace(out)
  }
  return out
}

/** Steps 2, 3, 4, 6 and 7 of the pipeline for one piece. Step 1 is the parser's; step 5 needs the whole screen. */
export function validatePiece(piece: Piece, region: RegionName, options: ValidateOptions = {}): RenderNode {
  const registry = options.registry ?? defaultRegistry
  const log = options.log ?? defaultLog
  const base = { region, component: piece.component, ask: piece.ask, emphasis: piece.emphasis, tone: piece.tone }

  const spec = registry.get(piece.component)
  if (!spec || !(spec.pickable || SYSTEM_COMPONENTS.has(spec.name))) {
    log.warn('unknown component', { id: piece.id, component: piece.component })
    return { ...base, id: piece.id, props: {}, state: 'error', error: PIECE_ERRORS.unknown(piece.component), unknown: true }
  }

  const parsed = spec.schema.safeParse(piece.props)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    log.warn('props failed the component schema', { id: piece.id, component: piece.component, path: issue?.path.join('.'), issue: issue?.message })
    return { ...base, id: piece.id, props: isRecord(piece.bound) ? piece.bound : {}, state: 'error', error: PIECE_ERRORS.props(piece.component) }
  }

  const id = registry.deriveId(piece.component, piece.props)
  if (id !== piece.id) log.warn('piece id differs from the derived id; the derived id wins', { sent: piece.id, derived: id })

  if (piece.state) {
    return { ...base, id, props: piece.bound ?? {}, state: piece.state, error: piece.error, warming: piece.warming }
  }
  if (piece.bound === undefined) {
    if (!options.final) return { ...base, id, props: {}, state: 'skeleton' }
    log.warn('piece has no data after the composition finished', { id })
    return { ...base, id, props: {}, state: 'error', error: PIECE_ERRORS.data(piece.component) }
  }

  return { ...base, id, props: checkProse(piece, piece.bound, log), state: 'default' }
}

type HeightOf = (component: string) => 'fixed' | 'grows' | 'plot' | undefined

const ONLY: Partial<Record<RegionName, { component: string; max: number }>> = {
  insight: { component: 'Insight', max: 1 },
  metrics: { component: 'Metric', max: 4 },
  action: { component: 'ActionCard', max: 1 },
}

/** A column holds one piece, or a stack of two when the second is `fixed` or `plot`; a FilterChips may sit above its target. */
function column(nodes: RenderNode[], region: 'main' | 'side', heightOf: HeightOf, drop: (n: RenderNode, why: string) => void): RenderNode[] {
  const kept: RenderNode[] = []
  for (const node of nodes) {
    const body = kept.filter(n => n.component !== 'FilterChips')
    if (node.component === 'FilterChips') {
      if (kept.some(n => n.component === 'FilterChips')) drop(node, 'a column holds one FilterChips')
      else kept.push(node)
      continue
    }
    if (body.length >= 2) {
      drop(node, `the ${region} column already holds two pieces`)
      continue
    }
    // A second grows piece stacks below the first in main; in side it would make the columns uneven.
    if (body.length === 1 && region === 'side' && heightOf(node.component) === 'grows') {
      drop(node, 'a second piece in side must be fixed or plot')
      continue
    }
    kept.push(node)
  }
  return kept
}

/** Step 5: the composition rules that need the whole screen. A violating piece is dropped with a logged reason. */
export function applyRules(regions: Record<RegionName, RenderNode[]>, options: ValidateOptions = {}): Record<RegionName, RenderNode[]> {
  const registry = options.registry ?? defaultRegistry
  const log = options.log ?? defaultLog
  const heightOf: HeightOf = c => registry.heightClass(c)
  const drop = (node: RenderNode, why: string) => log.warn('piece dropped by a composition rule', { id: node.id, region: node.region, rule: why })
  const out = { ...regions }

  for (const region of ['insight', 'metrics', 'action'] as const) {
    const rule = ONLY[region]!
    const kept: RenderNode[] = []
    for (const node of regions[region]) {
      if (node.component !== rule.component && !node.unknown) drop(node, `${region} holds only ${rule.component}`)
      else if (kept.length >= rule.max) drop(node, `${region} holds at most ${rule.max}`)
      else kept.push(node)
    }
    out[region] = kept
  }

  let hot = 0
  out.metrics = out.metrics.filter(node => {
    if (!isRecord(node.props) || node.props.hot !== true) return true
    hot += 1
    if (hot <= 2) return true
    drop(node, 'at most two metrics are hot')
    return false
  })

  out.main = column(regions.main, 'main', heightOf, drop)
  out.side = column(regions.side, 'side', heightOf, drop)
  const lead = (nodes: RenderNode[]) => nodes.find(n => n.component !== 'FilterChips')
  const [m, s] = [lead(out.main), lead(out.side)]
  if (options.free && m && s && heightOf(m.component) === 'grows' && heightOf(s.component) === 'grows') {
    drop(s, 'two grows pieces never share a row')
    out.side = out.side.filter(n => n !== s)
  }
  return out
}

/** Steps 2 to 7 for a whole composition, or for the tree the stream has built so far. */
export function validateRegions(regions: Regions, options: ValidateOptions = {}): Record<RegionName, RenderNode[]> {
  const log = options.log ?? defaultLog
  const seen = new Set<string>()
  const nodes = emptyRegions() as unknown as Record<RegionName, RenderNode[]>
  for (const region of REGION_NAMES) {
    nodes[region] = []
    for (const piece of regions[region]) {
      const node = validatePiece(piece, region, options)
      if (seen.has(node.id)) {
        log.warn('duplicate piece id dropped', { id: node.id, region })
        continue
      }
      seen.add(node.id)
      nodes[region].push(node)
    }
  }
  return applyRules(nodes, options)
}
