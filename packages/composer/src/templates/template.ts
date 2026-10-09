import { createLogger, type LogRecord } from '@genui-github/core'
import { compositionSchema, REGION_NAMES, toScreen, type Ask, type Built, type Composition, type Density, type Piece, type RegionName, type Regions } from '@genui-github/renderer'
import type { DataContext } from '../bind/types'
import { enforceRules } from '../rules'
import type { TemplateId } from './needs'

// A template turns a data context into a whole screen, deterministically, with no model call. Its prose
// starts as the system's own true sentences; the fill step (Haiku) may then rewrite the slots it names.

/** What the classifier pulled out of the question. */
export interface TemplateParams {
  pr?: number
  handle?: string
  branch?: string
  window?: string
  day?: string
  weekday?: string
  hour?: number
}

/** One sentence the fill step may rewrite: where it is, how long it may be, and which data it may cite. */
export interface ProseSlot {
  pieceId: string
  /** The prop holding the sentence, in both the model props and the bound props. */
  field: string
  max: number
  kind: 'insight' | 'finding' | 'delta' | 'summary'
}

export interface ComposedScreen {
  density: Density
  regions: Regions
  asks: Ask[]
  slots: ProseSlot[]
}

export interface Template {
  id: TemplateId
  density: Density
  compose(ctx: DataContext, params: TemplateParams): ComposedScreen
}

/** A region list without the gaps a template leaves when a piece does not apply to this repo. */
export const pieces = (...list: (Piece | null | undefined | false)[]): Piece[] => list.filter((p): p is Piece => Boolean(p))

export function regions(r: Partial<Regions>): Regions {
  return { insight: r.insight ?? [], metrics: r.metrics ?? [], main: r.main ?? [], side: r.side ?? [], action: r.action ?? [] }
}

/** A composed screen as a Composition, ready to validate and stream. `built` is the route's. */
export function toComposition(id: string, screen: ComposedScreen, built: Built): Composition {
  return { id, density: screen.density, regions: screen.regions, asks: screen.asks.slice(0, 4), built }
}

/** Built figures for a composition no model touched. */
export function templateBuilt(template: TemplateId, ctx: DataContext, chose: string[]): Built {
  return {
    template,
    model: 'none',
    tokens: { input: 0, cached: 0, output: 0 },
    costUsd: 0,
    latencyMs: { classify: 0, data: 0, compose: 0, total: 0 },
    githubReads: ctx.githubReads,
    chose,
  }
}

/** The component names in reading order, `Metric × 4` style, for the built block. */
export function chose(regionsOf: Regions): string[] {
  const names = REGION_NAMES.flatMap(r => regionsOf[r].map(p => p.component))
  const out: string[] = []
  for (const name of names) {
    const last = out.at(-1)
    const match = last?.match(/^(.+?)(?: × (\d+))?$/)
    if (match && match[1] === name) out[out.length - 1] = `${name} × ${Number(match[2] ?? 1) + 1}`
    else out.push(name)
  }
  return out
}

export interface TreeCheck {
  ok: boolean
  problems: string[]
}

/**
 * A valid tree: the format's schema passes, every piece passes the renderer's validation with nothing
 * logged and no piece in its error state, and no composition rule drops anything.
 */
export function checkTree(composition: Composition, options: { question?: string; allowError?: RegionName[] } = {}): TreeCheck {
  const problems: string[] = []
  const parsed = compositionSchema.safeParse(composition)
  if (!parsed.success) problems.push(...parsed.error.issues.map(i => `format: ${i.path.join('.')} ${i.message}`))
  const records: LogRecord[] = []
  const log = createLogger('check', { level: 'debug', sink: r => records.push(r) })
  const screen = toScreen(composition, { log })
  problems.push(...records.map(r => `renderer: ${r.message} ${JSON.stringify(r.fields)}`))
  for (const region of REGION_NAMES) {
    for (const node of screen.regions[region]) {
      if (node.state === 'error' && !options.allowError?.includes(region)) problems.push(`error piece: ${node.id} · ${node.error?.cause}`)
    }
  }
  const { drops } = enforceRules(composition, { question: options.question, log: createLogger('check', { sink: () => {} }) })
  problems.push(...drops.map(d => `rule: ${d.id} · ${d.rule}`))
  return { ok: problems.length === 0, problems }
}

export const quietLog = createLogger('composer:template', { sink: () => {} })
