import { isMeasureId, type MeasureId } from '@genui-github/data'
import { createLogger } from '@genui-github/core'
import type { Piece } from '@genui-github/renderer/core'
import { BINDERS } from './bind'
import { systemFinding as barFinding } from './bind/BarChart'
import { systemFinding as comparisonFinding } from './bind/Comparison'
import { systemSummary as heatmapSummary } from './bind/Heatmap'
import { systemInsight } from './bind/Insight'
import { systemFinding as lineFinding } from './bind/LineChart'
import type { DataContext } from './bind/types'
import { proseProblems } from './fill'

// Pipeline step 6 in the composer, before anything streams: prose whose figures its piece's data does not
// hold is replaced by the system's own sentence (or, for a delta, left out). The renderer checks again.

const log = createLogger('composer:prose')

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** The prose field each component carries, its limit, and the system's own sentence for it. */
const FIELDS: Record<string, { field: string; max: number; system?: (ctx: DataContext, props: never) => string }> = {
  Insight: { field: 'sentence', max: 120 },
  Metric: { field: 'delta', max: 32 },
  LineChart: { field: 'finding', max: 120, system: lineFinding },
  BarChart: { field: 'finding', max: 120, system: barFinding },
  Comparison: { field: 'finding', max: 90, system: comparisonFinding },
  Heatmap: { field: 'summary', max: 120, system: heatmapSummary },
}

const DEFAULT_KEYS: MeasureId[] = ['open-prs', 'prs-merged', 'review-wait-median', 'contributors']

function rebind(ctx: DataContext, piece: Piece, props: Record<string, unknown>): Piece {
  const binder = BINDERS[piece.component] as unknown as (c: DataContext, p: unknown, e?: object) => Piece
  return binder(ctx, props, { ask: piece.ask, emphasis: piece.emphasis, tone: piece.tone })
}

/** The insight in the system's words, from the measures the model cited (or the overview's when it cited none). */
export function systemInsightFor(ctx: DataContext, props: unknown, tone?: Piece['tone']): Piece {
  const sources = Array.isArray(record(props).sources) ? (record(props).sources as { key?: unknown }[]) : []
  const keys = sources.map(s => s.key).filter((k): k is MeasureId => typeof k === 'string' && isMeasureId(k))
  const sys = systemInsight(ctx, keys.length ? keys : DEFAULT_KEYS)
  const binder = BINDERS.Insight as unknown as (c: DataContext, p: unknown, e?: object) => Piece
  return binder(ctx, tone ? { ...sys, tone } : sys, {})
}

/** A piece with its prose checked: kept as written when every figure is in its data, else the system's. */
export function checkedProse(ctx: DataContext, piece: Piece): { piece: Piece; replaced: boolean } {
  const rule = FIELDS[piece.component]
  if (!rule || piece.state) return { piece, replaced: false }
  const text = record(piece.props)[rule.field]
  if (typeof text !== 'string') return { piece, replaced: false }
  const problems = proseProblems(text, piece, rule.max, `${JSON.stringify(ctx.view)} ${JSON.stringify(piece.bound)}`)
  if (!problems.length) return { piece, replaced: false }
  log.info('prose replaced by the system sentence', { id: piece.id, problems })
  if (piece.component === 'Insight') return { piece: systemInsightFor(ctx, piece.props, piece.tone), replaced: true }
  const props = { ...record(piece.props) }
  if (rule.system) props[rule.field] = rule.system(ctx, props as never)
  else delete props[rule.field]
  return { piece: rebind(ctx, piece, props), replaced: true }
}
