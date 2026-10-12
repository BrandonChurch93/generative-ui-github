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

/** A scorer left out of a run on purpose: "not scored · no routing". Null when it was scored. */
export function notScoredWords(file: ResultsFile, scorer: ScorerName): string | null {
  const why = file.notScored?.[scorer]
  return why ? `not scored${MIDDOT}${why}` : null
}

const FRACTIONS = ['', '', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** "about a seventh", or null when the ratio has no plain word. */
export function fractionWords(part: number, whole: number): string | null {
  if (part <= 0 || whole <= part) return null
  const word = FRACTIONS[Math.round(whole / part)]
  return word ? `about a ${word}` : null
}

/** One scorer's mean pass rate over the cases of one kind, across every run. */
function kindRate(file: ResultsFile, scorer: ScorerName, off: boolean): number | null {
  const scored = file.cases.filter(c => (c.kind === 'off-template') === off && c.scores[scorer])
  return scored.length ? scored.filter(c => c.scores[scorer]!.pass).length / scored.length : null
}

/**
 * The three-model finding, in one sentence, shown only while the runs bear out each clause: Haiku alone matches
 * production on template, bindings and numbers; it misses only off-template, where production hands the case to
 * Sonnet; and production does better there. Otherwise null, so a later run never leaves a stale claim on the page.
 */
export function modelFinding(production: ResultsFile, haiku: ResultsFile): string | null {
  const [p, h] = [production.aggregate, haiku.aggregate]
  const same = (['template', 'bindings', 'numbers'] as const).every(k => p.pass[k] && h.pass[k] && pct(p.pass[k].mean) === pct(h.pass[k].mean))
  const share = fractionWords(h.cost.perCompositionUsd, p.cost.perCompositionUsd)
  const misses = failingCases(haiku).map(r => haiku.cases.find(c => c.id === r.id)!)
  const offOnly = misses.length > 0 && misses.every(c => c.kind === 'off-template')
  const lengthOnly = misses.every(c => SCORER_ORDER.every(s => !c.scores[s] || c.scores[s].pass || s === 'schema' || s === 'rules'))
  const better = (['schema', 'rules'] as const).some(k => (kindRate(production, k, true) ?? 0) > (kindRate(haiku, k, true) ?? 1))
  const onTemplateSame = (['schema', 'rules'] as const).every(k => kindRate(production, k, false) === kindRate(haiku, k, false))
  if (!same || !share || !offOnly || !lengthOnly || !better || !onTemplateSame) return null
  return `Haiku-only matches production on template, bindings and numbers at ${share} of the cost; its misses are off-template copy-length rules; Sonnet earns its cost only on off-template rule compliance.`
}

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
