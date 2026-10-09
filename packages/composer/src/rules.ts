import { createLogger, type Logger } from '@genui-github/core'
import { applyRules, REGION_NAMES, validatePiece, type Ask, type Composition, type Density, type Piece, type RenderNode } from '@genui-github/renderer'
import { TEMPLATE_NEEDS } from './templates/needs'

// The composition rules (docs/composer.md) enforced in code. The structural ones (one insight, four metrics,
// two hot, one action, the columns) are the renderer's `applyRules`, shared so both ends agree; the rest
// are here. A violating piece is dropped, or its offending part, with a logged reason; the rest renders.

const defaultLog = createLogger('composer:rules')

export interface RuleDrop {
  id: string
  rule: string
}

/** Rule 9: compact for a quick answer, spacious for a walkthrough, else comfortable. */
export function densityFor(question: string): Density {
  if (/\b(quick|short|tl;?dr|brief|at a glance|one line)\b/i.test(question)) return 'compact'
  if (/\b(walk me through|explain|in detail|step by step|deep dive|why)\b/i.test(question)) return 'spacious'
  return 'comfortable'
}

/** Rule 10: what the templates can answer, as a person would type it. */
const ANSWERABLE: RegExp[] = [
  ...Object.values(TEMPLATE_NEEDS)
    .filter(t => t.kind === 'golden')
    .flatMap(t => [t.question, ...(t.alsoAsked ?? [])])
    .map(q => new RegExp(`^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')),
  /^Which checks are failing on \S+\?$/i,
  /^What's holding #\d+\?$/i,
  /^What has \S+ been working on\?$/i,
  /^What merged on .+\?$/i,
  /^What landed on .+ around .+\?$/i,
  /^Show me the .+$/i,
]

export const isAnswerable = (ask: string) => ANSWERABLE.some(re => re.test(ask.trim()))

/** Rule 5: the words a ContributorRank's band and a Comparison's verdicts already say. */
const RANK_WORDS = /\b(carr(y|ies)|at risk)\b/i
const VERDICT_WORDS = /\b(better|worse|steady|no change)\b/i

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

function stripLinks(piece: Piece, onScreen: { asks: Set<string>; titles: string[] }): { piece: Piece; dropped: number } {
  let dropped = 0
  const strip = (value: unknown) => {
    const props = record(value)
    if (!Array.isArray(props.steps)) return value
    const steps = (props.steps as Record<string, unknown>[]).map(step => {
      const link = record(step.link)
      const ask = typeof link.ask === 'string' ? link.ask.toLowerCase() : undefined
      if (!ask || !(onScreen.asks.has(ask) || onScreen.titles.some(t => ask.includes(t)))) return step
      dropped += 1
      const { link: _link, ...rest } = step
      return rest
    })
    return { ...props, steps }
  }
  const props = strip(piece.props)
  return { piece: { ...piece, props, ...(piece.bound !== undefined ? { bound: strip(piece.bound) } : {}) }, dropped }
}

const LISTS = new Set(['StatusList', 'Timeline', 'ContributorRank', 'PersonList', 'ActivityFeed'])

/**
 * Every rule, on a whole composition. Returns the composition with violating pieces (or their offending
 * part) removed, and what was removed and why.
 */
export function enforceRules(composition: Composition, options: { question?: string; log?: Logger } = {}): { composition: Composition; drops: RuleDrop[] } {
  const log = options.log ?? defaultLog
  const drops: RuleDrop[] = []
  const drop = (id: string, rule: string) => {
    drops.push({ id, rule })
    log.warn('piece dropped by a composition rule', { id, rule })
  }
  const pieces = REGION_NAMES.flatMap(r => composition.regions[r])
  const has = (component: string) => pieces.some(p => p.component === component)
  const regions = { ...composition.regions }

  // Rules 1 to 4, shared with the renderer: what it would drop, the composer drops first.
  const before = new Set(pieces.map(p => p.id))
  const silent = { warn: () => {} }
  const nodes = Object.fromEntries(REGION_NAMES.map(r => [r, composition.regions[r].map(p => validatePiece(p, r, { log: silent, final: true }))])) as Record<(typeof REGION_NAMES)[number], RenderNode[]>
  const kept = applyRules(nodes, { log: { warn: (message, fields) => drop(String(fields?.id), String(fields?.rule ?? message)) } })
  const keptIds = new Set(REGION_NAMES.flatMap(r => kept[r].map(n => n.id)))
  for (const r of REGION_NAMES) regions[r] = regions[r].filter(p => !before.has(p.id) || keptIds.has(p.id))
  if (!regions.insight.length) drop('insight:answer', 'the insight is always the first piece')

  // Rule 5.
  regions.metrics = regions.metrics.filter(p => {
    const delta = typeof record(p.props).delta === 'string' ? (record(p.props).delta as string) : ''
    if (has('ContributorRank') && RANK_WORDS.test(delta)) return drop(p.id, "a metric never repeats the rank band's words"), false
    if (has('Comparison') && VERDICT_WORDS.test(delta)) return drop(p.id, "a metric never repeats a comparison's verdict"), false
    return true
  })

  // Rule 6.
  const onScreen = {
    asks: new Set(pieces.filter(p => p.component !== 'Steps' && p.ask).map(p => p.ask!.toLowerCase())),
    titles: pieces.filter(p => LISTS.has(p.component) && typeof record(p.props).title === 'string').map(p => (record(p.props).title as string).toLowerCase()),
  }
  for (const r of REGION_NAMES) {
    regions[r] = regions[r].map(p => {
      if (p.component !== 'Steps') return p
      const { piece, dropped } = stripLinks(p, onScreen)
      if (dropped) drop(p.id, 'a Steps ask never recomposes a list already on screen')
      return piece
    })
  }

  // Rule 10.
  const asks: Ask[] = composition.asks.filter(a => (isAnswerable(a.ask) ? true : (drop(`ask:${a.ask}`, 'a follow-up ask must be answerable by a template'), false)))

  // Rule 9.
  const density = options.question ? densityFor(options.question) : composition.density

  return { composition: { ...composition, density, regions, asks: asks.slice(0, 4) }, drops }
}
