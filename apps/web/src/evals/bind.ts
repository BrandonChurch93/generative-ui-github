import type { MeasureId } from '@genui-github/data'
import type { ResultsFile } from '@genui-github/evals'
import type { Comparison, Metric, StatusList } from '@genui-github/ui/schemas'
import { MIDDOT } from '../shell/words'
import { answersWords, failingCases, pct, secondsWords, spreadWords, usd } from './view'

// The system binds every prop here from a results file, as the renderer fixtures bind theirs. No model writes
// any of it. An eval figure is not a repo measure, so the `measure` each piece carries is only its key.
const key = (id: string) => id as string as MeasureId

export function productionMetrics(file: ResultsFile): Metric.MetricProps[] {
  const a = file.aggregate
  const template = a.pass.template
  const bindings = a.pass.bindings
  const list: Metric.MetricProps[] = []
  if (template)
    list.push({ measure: key('eval-template'), label: 'Template accuracy', value: pct(template.mean), suffix: '%', format: 'count', delta: `${spreadWords(template)}${MIDDOT}${template.n} cases` })
  if (bindings)
    list.push({ measure: key('eval-bindings'), label: 'Bindings pass rate', value: pct(bindings.mean), suffix: '%', format: 'count', delta: `${spreadWords(bindings)}${MIDDOT}${bindings.n} cases` })
  list.push({
    measure: key('eval-done-p50'),
    label: 'Median time to done',
    value: (a.latency.doneP50 / 1000).toFixed(1),
    suffix: 's',
    format: 'text',
    delta: `p90 ${secondsWords(a.latency.doneP90)}${MIDDOT}${answersWords(a.outcomes.composed)}`,
  })
  list.push({
    measure: key('eval-cost'),
    label: 'Cost per answer',
    value: usd(a.cost.perCompositionUsd),
    format: 'text',
    delta: `${usd(a.cost.totalUsd)} for ${answersWords(a.outcomes.composed)}`,
  })
  return list
}

const PER = 10_000

const tenth = (rate: number) => Number((rate * 100).toFixed(1))

/**
 * Production against the sonnet run on what both are scored on: cost, median time to done, components F1 and
 * rules. Template and bindings are left out because the sonnet run skips routing by design.
 */
export function versusSonnet(production: ResultsFile, sonnet: ResultsFile): Comparison.ComparisonProps {
  const [p, s] = [production.aggregate, sonnet.aggregate]
  const pairs: Comparison.ComparisonPair[] = [
    {
      measure: key('eval-cost'),
      direction: 'lower-is-better',
      notable: true,
      name: `Cost, ${PER.toLocaleString('en-US')} answers`,
      meta: 'in US dollars',
      unit: 'count',
      current: p.cost.perCompositionUsd * PER,
      previous: s.cost.perCompositionUsd * PER,
    },
    {
      measure: key('eval-done-p50'),
      direction: 'lower-is-better',
      notable: true,
      name: 'Median time to done',
      meta: 'in milliseconds',
      unit: 'count',
      current: p.latency.doneP50,
      previous: s.latency.doneP50,
    },
  ]
  if (p.componentsF1 !== null && s.componentsF1 !== null)
    pairs.push({
      measure: key('eval-components'),
      direction: 'higher-is-better',
      notable: true,
      name: 'Components F1',
      meta: 'mean, as a percent',
      unit: 'percent',
      current: tenth(p.componentsF1),
      previous: tenth(s.componentsF1),
    })
  if (p.pass.rules && s.pass.rules)
    pairs.push({
      measure: key('eval-rules'),
      direction: 'higher-is-better',
      notable: true,
      name: 'Rules',
      meta: 'no piece dropped',
      unit: 'percent',
      current: tenth(p.pass.rules.mean),
      previous: tenth(s.pass.rules.mean),
    })
  const cost = pairs[0]!
  const finding =
    cost.previous > 0 && cost.current < cost.previous
      ? `Production costs ${Math.round(((cost.previous - cost.current) / cost.previous) * 100)}% less per answer than Sonnet alone`
      : 'Production against Sonnet on cost, speed, components and rules'
  return {
    title: 'Against Sonnet alone',
    window: 'month',
    pairs,
    finding,
    periods: { current: 'production', previous: 'sonnet', currentShort: 'production', previousShort: 'sonnet' },
    source: `from ${answersWords(production.aggregate.outcomes.composed)}${MIDDOT}${sonnet.aggregate.outcomes.composed.toLocaleString('en-US')} by Sonnet`,
  }
}

export function failingList(file: ResultsFile): StatusList.StatusListProps {
  const rows = failingCases(file)
  const cases = file.aggregate.cases
  return {
    kind: 'check',
    title: 'Cases that failed a check',
    meta: `${rows.length} of ${cases} cases${MIDDOT}${file.model}`,
    items: rows.map(r => ({ id: r.id, title: r.question, meta: r.meta, state: 'failed' })),
    emptyTone: 'good',
    empty: 'Every case passed every check',
    emptyMeta: `${cases} cases${MIDDOT}${file.aggregate.runs} runs`,
  }
}
