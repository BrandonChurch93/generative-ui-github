import { compose, memoryLimits, type ComposeDeps } from '@genui-github/composer'
import { MODELS } from '@genui-github/core'
import { computeMeasure, isMeasureId, type MeasureContext, type MeasureWindow } from '@genui-github/data'
import type { DataContext } from '@genui-github/data/server'
import { createStreamParser, toComposition, type Composition } from '@genui-github/renderer/core'
import { listScore, NA, pieces, rendererFindings, scoreBindings, scoreComponents, scoreHot, scoreTemplate, type Score } from './score'
import type { EvalCase } from './set'

// The runner (docs/evals.md, Runs): every case through the composer itself, never the route, so the visitor
// limit and the daily cap do not apply and the golden set and answer cache are skipped.

export const RUN_MODELS = ['production', 'sonnet', 'haiku'] as const
export type RunModel = (typeof RUN_MODELS)[number]

export const SCORERS = ['template', 'components', 'hot', 'schema', 'bindings', 'numbers', 'rules'] as const
export type ScorerName = (typeof SCORERS)[number]

export interface CaseResult {
  id: string
  kind: EvalCase['kind']
  repo: string
  question: string
  run: number
  outcome: 'composed' | 'refused' | 'failed'
  /** Where the classifier routed it; absent when it never classified (the `sonnet` run, a refusal). */
  routed?: string
  scores: Record<ScorerName, Score | null>
  latency: { firstPieceMs: number | null; doneMs: number }
  costUsd: number
  tokens: { input: number; cached: number; output: number }
  /** The refusal's or the failure's words, when it did not compose. */
  said?: string
  components?: string[]
}

export type RunDeps = Pick<ComposeDeps, 'models' | 'github' | 'cache'>

/** The composer's levers for each run model (docs/evals.md, Runs). */
function levers(model: RunModel): NonNullable<ComposeDeps['eval']> {
  if (model === 'sonnet') return { fresh: true, route: 'off-template', offTemplateModel: MODELS.sonnet }
  if (model === 'haiku') return { fresh: true, route: 'classify', offTemplateModel: MODELS.haiku }
  return { fresh: true, route: 'classify', offTemplateModel: MODELS.sonnet }
}

/** The data layer's own view of the context, for computing a measure over a window the piece asked for. */
function measureContext(ctx: DataContext): MeasureContext {
  const cachedAt = Object.fromEntries(Object.entries(ctx.shapes).map(([k, v]) => [k, (v as { cachedAt: string }).cachedAt]))
  return { now: ctx.now, shapes: ctx.shapes as MeasureContext['shapes'], cachedAt, ...(ctx.scope ? { scope: ctx.scope } : {}) }
}

const empty = (): Record<ScorerName, Score | null> => ({ template: NA, components: NA, hot: NA, schema: NA, bindings: NA, numbers: NA, rules: NA })

/** A case that should have composed and did not fails every scorer it would have had, rather than leaving them unscored. */
function failedScores(c: EvalCase, said: string): Record<ScorerName, Score | null> {
  const fail = { pass: false, reason: `nothing composed: ${said}` }
  return {
    ...empty(),
    template: fail,
    ...(c.expect.components ? { components: { ...fail, value: 0 } } : {}),
    ...(c.expect.hot ? { hot: fail } : {}),
    ...(c.expect.bindings ? { bindings: { ...fail, value: 0 } } : {}),
  }
}

export async function runCase(c: EvalCase, model: RunModel, deps: RunDeps, run = 1, now: () => number = Date.now): Promise<CaseResult> {
  let context: DataContext | undefined
  let routed: string | undefined
  let drops: string[] = []
  const started = now()
  const base = { id: c.id, kind: c.kind, repo: c.repo, question: c.question, run }
  const scores = empty()
  const outcome = await compose(
    { repo: c.repo, question: c.question, ...(c.from ? { from: c.from } : {}), timeZone: 'UTC' },
    {
      ...deps,
      limits: memoryLimits(),
      visitor: 'evals',
      dailyCapUsd: Number.POSITIVE_INFINITY,
      eval: {
        ...levers(model),
        onContext: ctx => (context = ctx),
        onRoute: t => (routed = t),
        onDrops: d => (drops = d.map(x => `${x.id} ${x.rule}`)),
      },
    },
  ).catch((error: Error) => ({ kind: 'failed' as const, error }))

  if (outcome.kind === 'failed') {
    return { ...base, outcome: 'failed', scores: failedScores(c, outcome.error.message), latency: { firstPieceMs: null, doneMs: now() - started }, costUsd: 0, tokens: { input: 0, cached: 0, output: 0 }, said: outcome.error.message }
  }
  if (outcome.kind === 'refused') {
    const said = outcome.refusal.message
    if (c.expect.error) scores.template = said === c.expect.error ? { pass: true } : { pass: false, reason: `said "${said}", expected "${c.expect.error}"` }
    else scores.template = { pass: false, reason: `refused: ${said}` }
    return { ...base, outcome: 'refused', scores, latency: { firstPieceMs: null, doneMs: now() - started }, costUsd: 0, tokens: { input: 0, cached: 0, output: 0 }, said }
  }

  const parser = createStreamParser({ log: { warn: () => {} } })
  let firstPieceMs: number | null = null
  for await (const op of outcome.ops) {
    if (op.op === 'add' && firstPieceMs === null) firstPieceMs = now() - started
    parser.push(`${JSON.stringify(op)}\n`)
  }
  const doneMs = now() - started
  const tree = parser.end()
  const composition: Composition | undefined = toComposition(tree)
  if (!composition) {
    const said = tree.error ?? 'the stream ended without a finished composition'
    return { ...base, outcome: 'failed', routed, scores: failedScores(c, said), latency: { firstPieceMs, doneMs }, costUsd: 0, tokens: { input: 0, cached: 0, output: 0 }, said }
  }

  if (c.expect.error) scores.template = { pass: false, reason: `composed an answer, expected "${c.expect.error}"` }
  else scores.template = scoreTemplate(c.expect.template, composition.built.template)
  if (c.expect.components) scores.components = scoreComponents(c.expect.components, composition)
  if (c.expect.hot) scores.hot = scoreHot(c.expect.hot, composition)
  if (c.expect.bindings) {
    const ctx = context
    scores.bindings = ctx
      ? scoreBindings(c.expect.bindings, composition, ctx, (measure, window) => (isMeasureId(measure) ? computeMeasure(measure, measureContext(ctx), window as MeasureWindow)?.value : undefined))
      : { pass: false, reason: 'no context was built' }
  }
  const found = rendererFindings(composition)
  scores.schema = listScore(found.schema)
  scores.numbers = listScore(found.numbers)
  scores.rules = listScore([...drops, ...found.rules])

  return {
    ...base,
    outcome: 'composed',
    routed,
    scores,
    latency: { firstPieceMs, doneMs },
    costUsd: composition.built.costUsd,
    tokens: composition.built.tokens,
    components: pieces(composition).map(p => p.component),
  }
}

/** Runs `tasks` with at most `limit` in flight, keeping their order in the result. */
export async function pool<T>(tasks: (() => Promise<T>)[], limit: number, onDone?: (done: number) => void): Promise<T[]> {
  const out = new Array<T>(tasks.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      out[i] = await tasks[i]!()
      onDone?.(++done)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return out
}

export interface Aggregate {
  cases: number
  runs: number
  /** Pass rate per scorer over the cases it applies to: mean across runs, and the lowest and highest run. */
  pass: Record<ScorerName, { mean: number; min: number; max: number; n: number } | null>
  /** Mean components F1. */
  componentsF1: number | null
  latency: { doneP50: number; doneP90: number; firstPieceP50: number | null; firstPieceP90: number | null }
  cost: { totalUsd: number; perCompositionUsd: number }
  outcomes: Record<CaseResult['outcome'], number>
}

const quantile = (values: number[], q: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
}

export function aggregate(results: CaseResult[]): Aggregate {
  const runs = [...new Set(results.map(r => r.run))].sort()
  const pass = {} as Aggregate['pass']
  for (const scorer of SCORERS) {
    const rates = runs
      .map(run => results.filter(r => r.run === run && r.scores[scorer] !== null))
      .filter(list => list.length)
      .map(list => list.filter(r => r.scores[scorer]!.pass).length / list.length)
    const n = results.filter(r => r.run === runs[0] && r.scores[scorer] !== null).length
    pass[scorer] = rates.length ? { mean: round(rates.reduce((a, b) => a + b, 0) / rates.length), min: round(Math.min(...rates)), max: round(Math.max(...rates)), n } : null
  }
  const f1s = results.map(r => r.scores.components?.value).filter((v): v is number => typeof v === 'number')
  const composed = results.filter(r => r.outcome === 'composed')
  const firsts = composed.map(r => r.latency.firstPieceMs).filter((v): v is number => v !== null)
  const total = results.reduce((sum, r) => sum + r.costUsd, 0)
  return {
    cases: new Set(results.map(r => r.id)).size,
    runs: runs.length,
    pass,
    componentsF1: f1s.length ? round(f1s.reduce((a, b) => a + b, 0) / f1s.length) : null,
    latency: {
      doneP50: quantile(composed.map(r => r.latency.doneMs), 0.5),
      doneP90: quantile(composed.map(r => r.latency.doneMs), 0.9),
      firstPieceP50: firsts.length ? quantile(firsts, 0.5) : null,
      firstPieceP90: firsts.length ? quantile(firsts, 0.9) : null,
    },
    cost: { totalUsd: Number(total.toFixed(4)), perCompositionUsd: composed.length ? Number((total / composed.length).toFixed(6)) : 0 },
    outcomes: { composed: composed.length, refused: results.filter(r => r.outcome === 'refused').length, failed: results.filter(r => r.outcome === 'failed').length },
  }
}

const round = (n: number) => Number(n.toFixed(3))

export interface ResultsFile {
  model: RunModel
  /** The model ids behind the run, for the results page. */
  models: { classify: string | null; fill: string | null; offTemplate: string }
  date: string
  aggregate: Aggregate
  /** The same, for the 60 golden cases: what the regression gate compares. */
  golden: Aggregate
  cases: CaseResult[]
}

export function resultsFile(model: RunModel, cases: CaseResult[], date = new Date().toISOString()): ResultsFile {
  const off = model === 'haiku' ? MODELS.haiku : MODELS.sonnet
  return {
    model,
    models: { classify: model === 'sonnet' ? null : MODELS.haiku, fill: model === 'sonnet' ? null : MODELS.haiku, offTemplate: off },
    date,
    aggregate: aggregate(cases),
    golden: aggregate(cases.filter(c => c.kind === 'golden')),
    cases,
  }
}
