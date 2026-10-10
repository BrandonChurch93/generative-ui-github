import { z } from 'zod'
import { createLogger } from '@genui-github/core'
import { MODELS } from '@genui-github/core'
import type { Piece, RegionName } from '@genui-github/renderer/core'
import { REGION_NAMES } from '@genui-github/renderer/core'
import { extractNumbers, seriesFacts, validateNumbers } from '@genui-github/ui/schemas'
import { isMeasureId, MEASURES } from '@genui-github/data'
import { BarChartFacts, ComparisonReading, Heatmap, HeatmapHeat, type Comparison } from '@genui-github/ui/schemas'
import type { CallUsage, ModelClient } from './anthropic'
import { bind } from './templates/build'
import type { DataContext } from './bind/types'
import type { ComposedScreen, ProseSlot } from './templates/template'

// The fill step (docs/composer.md): one Haiku call rewrites a template's prose slots in plain words. A rewrite is
// kept only when every figure in it is in that piece's own data; otherwise the system's sentence stays.

const log = createLogger('composer:fill')

const SYSTEM = [
  'You write the short sentences on a screen that answers a question about a GitHub repo. The screen is already built; you only rewrite the sentences you are given.',
  '',
  'Rules for every sentence:',
  '- Use only the figures listed for that sentence. Never compute a new figure, never round differently, never add a date, a version or a count that is not listed.',
  '- Answer the question plainly. Lead with what matters. One sentence, or two short ones for the insight.',
  '- Stay within the character limit given.',
  '- Sentence case. No em dashes: use a period, a comma or an interpunct (·). No exclamation marks. Never apologize.',
  '- Put identifiers (branch, check, file names) in backticks, exactly as they appear in the data.',
  '- Never write status words like tags or verdicts; the system writes those.',
  '- A metric delta is a short phrase under the number (at most 32 characters), like "2 merged this week" or "oldest waiting 6 days". Leave it empty when nothing worth saying is in the figures.',
  '- If you cannot improve a sentence within these rules, return it unchanged.',
].join('\n')

export const fillSchema = z.object({ slots: z.array(z.object({ id: z.string(), text: z.string() })) })

const slotId = (s: ProseSlot) => `${s.pieceId}#${s.field}`

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** The figures a piece's prose may cite, the way the piece itself checks them. */
export function allowedFigures(piece: Piece): number[] {
  const b = record(piece.bound)
  switch (piece.component) {
    case 'Insight': {
      const map = record(b.sourceMap) as Record<string, { numbers?: number[] }>
      return Object.values(map).flatMap(s => s.numbers ?? [])
    }
    case 'Metric':
      return [...(piece.cites ?? []), ...extractNumbers(String(b.value ?? '')).map(n => n.value), ...extractNumbers(String(b.suffix ?? '')).map(n => n.value)]
    case 'LineChart': {
      const series = (b.series as { points: (number | null)[] }[] | undefined) ?? []
      return [...series.flatMap(s => seriesFacts(s.points)), ...(Array.isArray(b.failures) ? seriesFacts(b.failures as number[]) : [])]
    }
    case 'BarChart':
      return BarChartFacts.barFacts(((b.bars as { value: number }[] | undefined) ?? []).map(x => x.value))
    case 'Comparison':
      return ComparisonReading.comparisonFacts(b as unknown as Comparison.ComparisonProps)
    case 'Heatmap': {
      const props = b as unknown as Heatmap.HeatmapProps
      return HeatmapHeat.heatFacts(props.counts ?? [], Heatmap.WINDOW_LABELS[props.window]?.weeks ?? 12)
    }
    default:
      return []
  }
}

type NumberOptions = NonNullable<Parameters<typeof validateNumbers>[2]>

/** A piece whose figures are a ratio in × is checked so a percent never stands in for it. */
export function figureOptions(piece: Piece): NumberOptions {
  const b = record(piece.bound)
  const ratio = (key: unknown) => typeof key === 'string' && isMeasureId(key) && MEASURES[key].unit === 'ratio'
  switch (piece.component) {
    case 'Insight':
      return { ratio: Object.keys(record(b.sourceMap)).some(ratio) }
    case 'Metric':
      return { ratio: ratio(b.measure) }
    case 'LineChart':
      return { ratio: b.unit === 'ratio' }
    default:
      return {}
  }
}

// Built from its code point: the repo's lint bans the character in source, escaped or not.
const EM_DASH = String.fromCodePoint(8212)
const CLOCK = /\b(\d{1,2}):00\b/g
const QUOTED = /`([^`]*)`/g
const VERSION = /\bv\d+(?:\.\d+)*\b/gi

/** The data holds `term` as a whole word or path, not as part of a longer one (`can` is not `canary`). */
function mentions(data: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\w./-])${escaped}([^\\w./-]|$)`).test(data)
}

/**
 * Stricter than the renderer's check, which sets aside anything in backticks and any version: here a backticked
 * term or a version must appear in the data as written, so no figure can hide in one.
 */
export function proseProblems(text: string, piece: Piece, max: number, data: string): string[] {
  const problems: string[] = []
  if (text.length > max) problems.push(`over ${max} characters`)
  if (text.includes(EM_DASH)) problems.push('an em dash')
  for (const [, term] of text.matchAll(QUOTED)) {
    // Backticks are for identifiers; a term made of figures is a figure, and is checked as one.
    const figure = /^[\d.,%\s:+-]+$/.test(term!)
    if (figure ? !validateNumbers(term!, allowedFigures(piece), figureOptions(piece)).ok : !mentions(data, term!)) problems.push(`\`${term}\` is not in the data`)
  }
  for (const [version] of text.matchAll(VERSION)) if (!mentions(data, version)) problems.push(`${version} is not in the data`)
  const hours = piece.component === 'Heatmap' ? [...text.matchAll(CLOCK)].map(m => Number(m[1])) : []
  if (hours.some(h => h > 23)) problems.push('an hour past 23')
  const plain = piece.component === 'Heatmap' ? text.replace(CLOCK, t => ' '.repeat(t.length)) : text
  const check = validateNumbers(plain, allowedFigures(piece), figureOptions(piece))
  if (!check.ok) problems.push(`figures not in the data: ${check.mismatches.map(m => m.raw).join(', ')}`)
  return problems
}

function findPiece(screen: ComposedScreen, id: string): { region: RegionName; index: number; piece: Piece } | undefined {
  for (const region of REGION_NAMES) {
    const index = screen.regions[region].findIndex(p => p.id === id)
    if (index >= 0) return { region, index, piece: screen.regions[region][index]! }
  }
  return undefined
}

export interface FillResult {
  screen: ComposedScreen
  usage: CallUsage | null
  /** Slots rewritten, and slots refused with why. */
  kept: string[]
  refused: { id: string; problems: string[] }[]
}

/** Rewrites what it can in one call. A screen with no slots, or a failed call, comes back as it was. */
export async function fill(client: ModelClient, ctx: DataContext, screen: ComposedScreen, question: string): Promise<FillResult> {
  const slots = screen.slots.filter(s => findPiece(screen, s.pieceId))
  if (!slots.length) return { screen, usage: null, kept: [], refused: [] }
  const lines = slots.map(s => {
    const { piece } = findPiece(screen, s.pieceId)!
    const current = String(record(piece.props)[s.field] ?? '')
    const figures = [...new Set(allowedFigures(piece).map(n => Math.round(n * 10) / 10))].slice(0, 60)
    return JSON.stringify({ id: slotId(s), kind: s.kind, max: s.max, component: piece.component, current, figures })
  })
  const user = [`Question: ${question}`, `Data: ${JSON.stringify(ctx.view)}`, 'Sentences to rewrite, one JSON object per line:', ...lines].join('\n')

  let value: z.infer<typeof fillSchema> | null = null
  let usage: CallUsage | null = null
  try {
    const out = await client.json({ model: MODELS.haiku, cachedSystem: SYSTEM, user, schema: fillSchema, maxTokens: 2048, effort: 'low' })
    value = out.value
    usage = out.usage
  } catch (error) {
    log.warn('fill call failed; the system sentences stay', { error: (error as Error).message })
    return { screen, usage, kept: [], refused: [] }
  }

  const next: ComposedScreen = { ...screen, regions: { ...screen.regions } }
  const kept: string[] = []
  const refused: FillResult['refused'] = []
  const data = JSON.stringify(ctx.view)
  for (const s of slots) {
    const text = value?.slots.find(x => x.id === slotId(s))?.text.trim()
    const at = findPiece(next, s.pieceId)
    if (!at || text === undefined) continue
    const current = String(record(at.piece.props)[s.field] ?? '')
    if (text === current || (!text && s.kind !== 'delta')) continue
    const props = { ...record(at.piece.props) }
    if (text) props[s.field] = text
    else delete props[s.field]
    const { ask, emphasis, tone } = at.piece
    const candidate = bind(ctx, at.piece.component, props, { ask, emphasis, tone })
    const problems = candidate.state ? ['the rewrite does not bind'] : text ? proseProblems(text, candidate, s.max, `${data} ${JSON.stringify(at.piece.bound)}`) : []
    if (problems.length) {
      refused.push({ id: slotId(s), problems })
      log.info('fill sentence refused; the system sentence stays', { id: slotId(s), problems })
      continue
    }
    const list = [...next.regions[at.region]]
    list[at.index] = candidate
    next.regions[at.region] = list
    kept.push(slotId(s))
  }
  return { screen: next, usage, kept, refused }
}

/** Every figure in the screen's prose that its piece's data does not hold: what must stay zero. */
export function unvalidatedFigures(screen: ComposedScreen, ctx: DataContext): string[] {
  const data = JSON.stringify(ctx.view)
  const out: string[] = []
  for (const region of REGION_NAMES) {
    for (const piece of screen.regions[region]) {
      if (piece.state) continue
      for (const field of ['sentence', 'delta', 'finding', 'summary']) {
        const text = record(piece.props)[field]
        if (typeof text !== 'string') continue
        const problems = proseProblems(text, piece, 1000, `${data} ${JSON.stringify(piece.bound)}`).filter(p => p.startsWith('figures') || p.includes('not in the data'))
        out.push(...problems.map(p => `${piece.id}#${field}: ${p}`))
      }
    }
  }
  return out
}
