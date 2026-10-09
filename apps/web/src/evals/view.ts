import type { Aggregate, CaseResult, ResultsFile, RunModel, ScorerName } from '@genui-github/evals'
import { MIDDOT, modelName, plural } from '../shell/words'

// The results page's own words and figures, all derived from a results file. Nothing here is model text.

export const SCORER_ORDER = ['template', 'components', 'hot', 'schema', 'bindings', 'numbers', 'rules'] as const satisfies readonly ScorerName[]

export const SCORER_WORDS: Record<ScorerName, { name: string; what: string }> = {
  template: { name: 'Template', what: 'expected template' },
  components: { name: 'Components', what: 'F1 at least 0.85' },
  hot: { name: 'Hot metrics', what: 'exact set' },
  schema: { name: 'Schema', what: 'every piece valid' },
  bindings: { name: 'Bindings', what: 'props match data' },
  numbers: { name: 'Numbers', what: 'no prose mismatch' },
  rules: { name: 'Rules', what: 'no piece dropped' },
}

export const MODEL_TITLE: Record<RunModel, string> = { production: 'Production', sonnet: 'Sonnet alone', haiku: 'Haiku alone' }

export type Rate = NonNullable<Aggregate['pass'][ScorerName]>

export const pct = (rate: number) => Math.round(rate * 100)

/** "82 to 86%", or "no spread" when every run scored the same. */
export function spreadWords(rate: Rate): string {
  const [lo, hi] = [pct(rate.min), pct(rate.max)]
  return lo === hi ? 'no spread' : `${lo} to ${hi}%`
}

export const secondsWords = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export function usd(amount: number): string {
  if (amount === 0) return '$0'
  return `$${amount.toFixed(amount < 0.1 ? 4 : 2)}`
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? n.toLocaleString('en-US')
export const timesWord = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${numberWord(n)} times`)

/** "Oct 9 · 11:20 UTC" */
export function runWhen(iso: string): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(date)
  return `${day}${MIDDOT}${time} UTC`
}

/** Who did what in a run, in words: "Haiku · Sonnet off-template". */
export function modelsLine(file: ResultsFile): string {
  const { classify, fill, offTemplate } = file.models
  if (!classify || !fill) return `${modelName(offTemplate)} for every question`
  if (classify === fill && fill === offTemplate) return `${modelName(fill)} everywhere`
  return `${modelName(fill)}${MIDDOT}${modelName(offTemplate)} off-template`
}

/** The ids behind a run, for the strip. */
export function modelIds(file: ResultsFile): string {
  const { classify, fill, offTemplate } = file.models
  if (!classify || !fill) return `${offTemplate} for everything`
  if (classify === fill && fill === offTemplate) return `${fill} for everything`
  const front = classify === fill ? `${classify} classify and fill` : `${classify} classify${MIDDOT}${fill} fill`
  return `${front}${MIDDOT}${offTemplate} off-template`
}

const KIND_WORDS: Record<CaseResult['kind'], [string, string]> = {
  golden: ['golden', 'golden'],
  paraphrase: ['paraphrase', 'paraphrases'],
  'off-template': ['off-template', 'off-template'],
  'cannot-answer': ['cannot-answer', 'cannot-answer'],
  'follow-up': ['follow-up', 'follow-ups'],
}

const firstRun = (file: ResultsFile) => {
  const run = Math.min(...file.cases.map(c => c.run))
  return file.cases.filter(c => c.run === run)
}

/** "60 golden, 20 paraphrases, 10 off-template, 3 cannot-answer and 6 follow-ups" */
export function setWords(file: ResultsFile): string {
  const counts = new Map<CaseResult['kind'], number>()
  for (const c of firstRun(file)) counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1)
  const parts = (Object.keys(KIND_WORDS) as CaseResult['kind'][])
    .filter(k => counts.has(k))
    .map(k => {
      const n = counts.get(k)!
      return `${n} ${KIND_WORDS[k][n === 1 ? 0 : 1]}`
    })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '')
}

/** The sample repos the golden cases ask about. */
export const repoCount = (file: ResultsFile) => new Set(file.cases.filter(c => c.kind === 'golden').map(c => c.repo)).size

/**
 * The `sonnet` run routes every question off-template on purpose, so its template score is read over the
 * off-template cases only: elsewhere it fails by design, which says nothing about the model.
 */
export function offTemplateRate(file: ResultsFile): Rate | null {
  const runs = [...new Set(file.cases.map(c => c.run))].sort((a, b) => a - b)
  const scored = (run: number) => file.cases.filter(c => c.run === run && c.kind === 'off-template' && c.scores.template !== null)
  const rates = runs.map(scored).filter(list => list.length).map(list => list.filter(c => c.scores.template!.pass).length / list.length)
  if (!rates.length) return null
  const round = (n: number) => Number(n.toFixed(3))
  return { mean: round(rates.reduce((a, b) => a + b, 0) / rates.length), min: round(Math.min(...rates)), max: round(Math.max(...rates)), n: scored(runs[0]!).length }
}

/** The template rate a run is judged on: all cases, except the `sonnet` run's off-template cases. */
export const templateRate = (file: ResultsFile) => (file.model === 'sonnet' ? offTemplateRate(file) : file.aggregate.pass.template)

export interface FailingCase {
  id: string
  question: string
  meta: string
  failedRuns: number
}

/** Every case that failed a scorer in any run, its runs collapsed into one row. Worst first. */
export function failingCases(file: ResultsFile): FailingCase[] {
  const runs = new Set(file.cases.map(c => c.run)).size
  const byId = new Map<string, CaseResult[]>()
  for (const c of file.cases) byId.set(c.id, [...(byId.get(c.id) ?? []), c])
  const rows: FailingCase[] = []
  for (const [id, results] of byId) {
    const failedRuns = results.filter(r => r.outcome === 'failed' || SCORER_ORDER.some(s => r.scores[s] && !r.scores[s].pass))
    if (!failedRuns.length) continue
    const tally = new Map<ScorerName, number>()
    for (const r of failedRuns) for (const s of SCORER_ORDER) if (r.scores[s] && !r.scores[s].pass) tally.set(s, (tally.get(s) ?? 0) + 1)
    const worst = SCORER_ORDER.filter(s => tally.has(s)).sort((a, b) => tally.get(b)! - tally.get(a)!)
    const lead = worst[0]
    const reason = lead
      ? failedRuns.map(r => r.scores[lead]).find(s => s && !s.pass)?.reason
      : failedRuns.find(r => r.said)?.said
    const what = lead ? worst.map(s => SCORER_WORDS[s].name.toLowerCase()).join(', ') : 'did not finish'
    const tail = reason ? `${what}${MIDDOT}${reason}` : what
    rows.push({ id, question: results[0]!.question, failedRuns: failedRuns.length, meta: `${id}${MIDDOT}failed in ${failedRuns.length} of ${runs} runs${MIDDOT}${tail}` })
  }
  return rows.sort((a, b) => b.failedRuns - a.failedRuns || a.id.localeCompare(b.id))
}

export const composedDone = (file: ResultsFile) => file.cases.filter(c => c.outcome === 'composed').map(c => c.latency.doneMs)

export const answersWords = (n: number) => plural(n, 'composed answer')
