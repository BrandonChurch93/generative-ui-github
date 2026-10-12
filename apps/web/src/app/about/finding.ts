import type { MeasureId } from '@genui-github/data'
import type { ResultsFile, RunModel, ScorerName } from '@genui-github/evals'
import type { Metric } from '@genui-github/ui/schemas'
import { fractionWords, MODEL_TITLE, modelFinding, notScoredWords, secondsWords, usd, type Rate } from '../../evals/view'
import { MIDDOT } from '../../shell/words'

// The About page's figures and the sentences that carry them, all derived from the results files. No model writes
// any of it, and nothing here is a fixed number: a new run changes the page without an edit.

const key = (id: string) => id as string as MeasureId

/** A pass rate as printed: whole percents stay whole, anything else keeps one decimal, so 99.7% never reads as 100%. */
export const rateWords = (mean: number) => `${Number((mean * 100).toFixed(1))}%`

export interface Runs {
  production: ResultsFile
  sonnet?: ResultsFile
  haiku?: ResultsFile
}

/** Production's four headline figures, each with Sonnet alone's beneath it when that run exists. */
export function headlineMetrics({ production, sonnet }: Runs): Metric.MetricProps[] {
  const a = production.aggregate
  const s = sonnet?.aggregate
  const versus = (words: string | undefined) => (words ? `${MODEL_TITLE.sonnet} ${words}` : undefined)
  const list: Metric.MetricProps[] = []
  const rate = (scorer: ScorerName, label: string) => {
    const r = a.pass[scorer]
    if (!r) return
    const other = s?.pass[scorer]
    list.push({ measure: key(`about-${scorer}`), label, value: Math.round(r.mean * 100), suffix: '%', format: 'count', delta: versus(other ? rateWords(other.mean) : undefined) })
  }
  rate('components', 'Expected components')
  rate('bindings', 'Numbers bound right')
  list.push({ measure: key('about-cost'), label: 'Cost per answer', value: usd(a.cost.perCompositionUsd), format: 'text', delta: versus(s ? usd(s.cost.perCompositionUsd) : undefined) })
  list.push({
    measure: key('about-done'),
    label: 'Median time to done',
    value: (a.latency.doneP50 / 1000).toFixed(1),
    suffix: 's',
    format: 'text',
    delta: versus(s ? secondsWords(s.latency.doneP50) : undefined),
  })
  return list
}

/** The finding in sentences, with every figure read from the runs. */
export function findingSentences({ production, sonnet, haiku }: Runs): string[] {
  const p = production.aggregate
  const out: string[] = []
  if (sonnet) {
    const s = sonnet.aggregate
    const comp = [p.pass.components, s.pass.components]
    const share = fractionWords(p.cost.perCompositionUsd, s.cost.perCompositionUsd)
    const cost = `${usd(p.cost.perCompositionUsd)} against ${usd(s.cost.perCompositionUsd)} per answer`
    if (comp[0] && comp[1])
      out.push(
        `Production's answers used the expected components in ${rateWords(comp[0].mean)} of cases, against ${rateWords(comp[1].mean)} for Sonnet composing freely from the same catalog${share ? `, at ${share} of the cost (${cost})` : ` (${cost})`}.`,
      )
    const faster = s.latency.doneP50 < p.latency.doneP50
    out.push(
      faster
        ? `Sonnet alone was faster: ${secondsWords(s.latency.doneP50)} to done at the median against ${secondsWords(p.latency.doneP50)}${s.latency.firstPieceP50 === null ? '' : `, with its first piece at ${secondsWords(s.latency.firstPieceP50)}`}. A template answer streams nothing until its fill returns, and that latency is the open problem.`
        : `Production was also faster: ${secondsWords(p.latency.doneP50)} to done at the median against ${secondsWords(s.latency.doneP50)}.`,
    )
  }
  const finding = haiku ? modelFinding(production, haiku) : null
  if (finding) out.push(finding)
  else if (haiku) out.push(`Haiku alone cost ${usd(haiku.aggregate.cost.perCompositionUsd)} per answer.`)
  return out
}

export interface Row {
  name: string
  what: string
  cells: Partial<Record<RunModel, string>>
}

const rateCell = (f: ResultsFile, scorer: ScorerName) => {
  const r: Rate | null = f.aggregate.pass[scorer]
  return r ? rateWords(r.mean) : (notScoredWords(f, scorer) ?? 'not scored')
}

/** The side-by-side table: the checks the finding rests on, then speed and cost. */
export function tableRows(runs: Runs): Row[] {
  const files = (['production', 'sonnet', 'haiku'] as const).flatMap(m => (runs[m] ? [runs[m]] : []))
  const each = (fn: (file: ResultsFile) => string) => Object.fromEntries(files.map(f => [f.model, fn(f)])) as Row['cells']
  return [
    {
      name: 'Template',
      what: 'routed to the expected template',
      cells: each(f => rateCell(f, 'template')),
    },
    { name: 'Components', what: 'F1 at least 0.85', cells: each(f => rateCell(f, 'components')) },
    { name: 'Bindings', what: 'props match the data', cells: each(f => rateCell(f, 'bindings')) },
    { name: 'Schema', what: 'every piece valid', cells: each(f => rateCell(f, 'schema')) },
    { name: 'Time to done', what: 'median', cells: each(f => secondsWords(f.aggregate.latency.doneP50)) },
    {
      name: 'First piece',
      what: 'median',
      cells: each(f => (f.aggregate.latency.firstPieceP50 === null ? 'none streamed' : secondsWords(f.aggregate.latency.firstPieceP50))),
    },
    { name: 'Cost', what: 'per answer', cells: each(f => usd(f.aggregate.cost.perCompositionUsd)) },
  ]
}

/** "99 cases · 3 runs each" */
export const runWords = (file: ResultsFile) => `${file.aggregate.cases} cases${MIDDOT}${file.aggregate.runs} runs each`
