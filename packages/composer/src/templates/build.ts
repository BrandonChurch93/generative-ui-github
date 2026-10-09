import type { MeasureId } from '@genui-github/data'
import { nextMilestone } from '@genui-github/data'
import type { Ask, Piece } from '@genui-github/renderer/core'
import type { Tone } from '@genui-github/ui/schemas'
import type { ActionCard, BarChart, Comparison, Heatmap, LineChart, Metric } from '@genui-github/ui/schemas'
import { BINDERS } from '../bind'
import type { DataContext, PieceExtras } from '../bind/types'
import { systemInsight } from '../bind/Insight'
import { systemFinding as barFinding } from '../bind/BarChart'
import { systemFinding as comparisonFinding } from '../bind/Comparison'
import { systemSummary as heatmapSummary } from '../bind/Heatmap'
import { systemFinding as lineFinding } from '../bind/LineChart'
import type { ProseSlot } from './template'
import { TEMPLATE_NEEDS, type TemplateId } from './needs'

// The small vocabulary every template composes with: bind by component name, metrics, the insight, the slots.

/** Binds model props through the component's binder. */
export function bind(ctx: DataContext, component: string, props: unknown, extras: PieceExtras = {}): Piece {
  const binder = BINDERS[component] as ((ctx: DataContext, props: unknown, extras?: PieceExtras) => Piece) | undefined
  if (!binder) throw new Error(`No binder for ${component}`)
  return binder(ctx, props, extras)
}

export const value = (ctx: DataContext, id: MeasureId): number | null => {
  const m = ctx.measures[id]
  if (!m) return null
  return typeof m.value === 'number' ? m.value : typeof m.value === 'object' && m.value !== null && 'count' in m.value ? m.value.count : null
}

export function metric(ctx: DataContext, measure: MeasureId, props: Partial<Metric.MetricModelProps> = {}, extras: PieceExtras = {}): Piece {
  return bind(ctx, 'Metric', { measure, ...props }, extras)
}

/** The answer in the system's words: the measures the template leads with, every figure from the data. */
export function insight(ctx: DataContext, keys: readonly MeasureId[], tone?: Tone): Piece {
  const props = systemInsight(ctx, keys)
  return bind(ctx, 'Insight', tone ? { ...props, tone } : props)
}

export function action(ctx: DataContext, props: ActionCard.ActionCardModelProps): Piece {
  return bind(ctx, 'ActionCard', props)
}

/** The prose a fill step may rewrite: the insight, and each finding or summary the pieces carry. */
export function slotsFor(pieces: readonly Piece[]): ProseSlot[] {
  const slots: ProseSlot[] = []
  for (const p of pieces) {
    if (p.state) continue
    if (p.component === 'Insight') slots.push({ pieceId: p.id, field: 'sentence', max: 120, kind: 'insight' })
    if (p.component === 'Metric') slots.push({ pieceId: p.id, field: 'delta', max: 32, kind: 'delta' })
    if (p.component === 'LineChart' || p.component === 'BarChart') slots.push({ pieceId: p.id, field: 'finding', max: 120, kind: 'finding' })
    if (p.component === 'Comparison') slots.push({ pieceId: p.id, field: 'finding', max: 90, kind: 'finding' })
    if (p.component === 'Heatmap') slots.push({ pieceId: p.id, field: 'summary', max: 120, kind: 'summary' })
  }
  return slots
}

/** Follow-up chips: golden questions other than this one, as a person would type them. */
export function asks(...ids: TemplateId[]): Ask[] {
  const labels: Partial<Record<TemplateId, string>> = {
    overview: 'Overview',
    'release-blockers': 'Release blockers',
    contributors: 'Contributors',
    'ci-trend': 'CI speed',
    'merged-recent': 'This week',
    'stale-issues': 'Stale issues',
    'biggest-pr': 'Biggest PR',
    'new-contributor': 'Getting started',
    responsiveness: 'Review speed',
    'month-compare': 'Month on month',
    'punch-card': 'When work happens',
    'release-diff': 'Last release',
  }
  return ids.slice(0, 4).map(id => ({ label: labels[id] ?? id, ask: TEMPLATE_NEEDS[id].question }))
}

/** The next release milestone's title, when the repo has a dated one. */
export function milestoneTitle(ctx: DataContext): string | undefined {
  const milestones = ctx.shapes.milestones
  return milestones ? (nextMilestone(milestones)?.title ?? undefined) : undefined
}

export const repoName = (ctx: DataContext) => `${ctx.repo.owner}/${ctx.repo.name}`

/** `#n` for the first few pull requests in a list, for an action's targets. */
export const refs = (numbers: readonly number[], n = 3) => numbers.slice(0, n).map(x => `#${x}`)

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const inWords = (n: number) => SPELLED[n] ?? String(n)

// Charts arrive with the system's own true sentence; the fill step may rewrite it later.

type WithoutProse<P, K extends string> = Omit<P, K> & Partial<Record<K, string>>

export function lineChart(ctx: DataContext, props: WithoutProse<LineChart.LineChartModelProps, 'finding'>, extras: PieceExtras = {}): Piece {
  const draft = { ...props, finding: props.finding ?? 'pending' } as LineChart.LineChartModelProps
  return bind(ctx, 'LineChart', { ...draft, finding: props.finding ?? lineFinding(ctx, draft) }, extras)
}

export function barChart(ctx: DataContext, props: WithoutProse<BarChart.BarChartModelProps, 'finding'>, extras: PieceExtras = {}): Piece {
  const draft = { ...props, finding: props.finding ?? 'pending' } as BarChart.BarChartModelProps
  return bind(ctx, 'BarChart', { ...draft, finding: props.finding ?? barFinding(ctx, draft) }, extras)
}

export function comparison(ctx: DataContext, props: WithoutProse<Comparison.ComparisonModelProps, 'finding'>, extras: PieceExtras = {}): Piece {
  const draft = { ...props, finding: props.finding ?? 'pending' } as Comparison.ComparisonModelProps
  return bind(ctx, 'Comparison', { ...draft, finding: props.finding ?? comparisonFinding(ctx, draft) }, extras)
}

export function heatmap(ctx: DataContext, props: WithoutProse<Heatmap.HeatmapModelProps, 'summary'>, extras: PieceExtras = {}): Piece {
  const draft = { ...props, summary: props.summary ?? 'pending' } as Heatmap.HeatmapModelProps
  return bind(ctx, 'Heatmap', { ...draft, summary: props.summary ?? heatmapSummary(ctx, draft) }, extras)
}
