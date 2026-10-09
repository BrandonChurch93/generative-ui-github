import { busFactor, ciRuns, failed, isMeasureId, isShapeName, mainWorkflow, type MeasureId, type MeasureResult, type ShapeName } from '@genui-github/data'
import { bound, type Binder, type DataContext } from './types'
import { inline, measureNumbers, measureWords, readMeasure, seriesFacts, shape, shortDate } from './group-a-shared'
import type { InsightModelProps, InsightProps, InsightSource } from './group-a-ui'
import { emptyMessage } from './Metric'

// Insight: the model's sentence and the keys it rests on. The system writes the source line from the data
// and lists every figure the sentence may cite, so a number the data does not hold is never rendered.

const DAY = 86_400_000
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const n = (v: number) => whole.format(v)
const minutes = (ms: number) => Math.round(ms / 6_000) / 10
const days = (ms: number) => [Math.floor(ms / DAY), Math.round(ms / DAY)]

/** A measure the template computed, or one computed now for its default window. */
function measureOf(ctx: DataContext, id: MeasureId): MeasureResult | null {
  return id in ctx.measures ? (ctx.measures[id] ?? null) : readMeasure(ctx, id)
}

function measureSource(ctx: DataContext, id: MeasureId): InsightSource {
  const result = measureOf(ctx, id)
  if (!result) return { words: inline(emptyMessage(ctx, id, ctx.scope)), numbers: [] }
  const numbers = measureNumbers(result, ctx.now)
  if (result.unit === 'clock' && typeof result.value === 'number') numbers.push(0)
  return { words: measureWords(result), numbers }
}

/** What a shape contributes to the source line, and the figures it holds. */
function shapeSource(ctx: DataContext, name: ShapeName): InsightSource | null {
  const branch = ctx.repo.defaultBranch
  const activity = shape(ctx, 'activity')
  switch (name) {
    case 'repo': {
      const r = shape(ctx, 'repo')
      return r ? { words: `${r.owner}/${r.name}`, numbers: [r.stars, r.forks, r.watchers, r.openIssues] } : null
    }
    case 'pulls': {
      const p = shape(ctx, 'pulls')
      if (!p) return null
      const open = activity?.open.pulls ?? p.open.length
      const extra = activity ? [activity.open.awaitingReview, activity.open.drafts, activity.open.changesRequested] : []
      return { words: `${n(open)} open pull requests`, numbers: [open, p.open.length, p.merged.length, ...extra, ...[...p.open, ...p.merged].map(x => x.number)] }
    }
    case 'issues': {
      const i = shape(ctx, 'issues')
      if (!i) return null
      const open = activity?.open.issues ?? i.open.length
      return { words: `${n(open)} open issues`, numbers: [open, i.open.length, i.closed.length, ...[...i.open, ...i.closed].map(x => x.number)] }
    }
    case 'activity': {
      if (!activity) return null
      const weekly = activity.weeks.flatMap(w => [w.issuesOpened, w.issuesClosed, w.pullsOpened, w.pullsClosed, w.pullsMerged])
      return { words: 'GitHub search counts', numbers: [...Object.values(activity.open), ...weekly, ...activity.months.map(m => m.pullsMerged), activity.weeks.length] }
    }
    case 'milestones': {
      const m = shape(ctx, 'milestones')
      if (!m) return null
      return { words: m.open.length === 1 ? `milestone ${m.open[0]!.title}` : `${n(m.open.length)} open milestones`, numbers: [m.open.length, ...m.open.flatMap(x => [x.open, x.closed, x.open + x.closed])] }
    }
    case 'checks': {
      const c = shape(ctx, 'checks')
      if (!c) return null
      const bad = c.runs.filter(failed).length
      return { words: `${n(c.runs.length)} check runs on ${branch}`, numbers: [c.runs.length, bad, c.runs.length - bad] }
    }
    case 'workflowRuns': {
      const w = shape(ctx, 'workflowRuns')
      if (!w) return null
      const runs = ciRuns(w)
      const bad = runs.filter(failed).length
      return { words: `${n(runs.length)} ${mainWorkflow(w) ?? 'workflow'} runs on ${w.branch}`, numbers: [runs.length, bad, runs.length - bad, w.runs.length] }
    }
    case 'ciDurationByWeek': {
      const c = shape(ctx, 'ciDurationByWeek')
      if (!c) return null
      const p50 = c.weeks.map(w => minutes(w.p50Ms))
      return { words: `${c.workflow ?? 'CI'} run times by week`, numbers: [...seriesFacts(p50), ...c.weeks.flatMap(w => [minutes(w.p90Ms), w.count, w.failures])] }
    }
    case 'failureRateByWeek': {
      const f = shape(ctx, 'failureRateByWeek')
      if (!f) return null
      return { words: 'failed runs by week', numbers: [...seriesFacts(f.weeks.map(w => w.rate * 100)), ...f.weeks.flatMap(w => [w.runs, w.failures])] }
    }
    case 'slowestJob': {
      const s = shape(ctx, 'slowestJob')
      return s ? { words: `slowest job in ${s.workflowName}`, numbers: [minutes(s.durationMs)] } : null
    }
    case 'staleIssues': {
      const s = shape(ctx, 'staleIssues')
      if (!s) return null
      const count = activity?.open.staleIssues ?? s.issues.length
      return { words: `${n(count)} stale issues`, numbers: [count, s.issues.length, 30, ...s.issues.flatMap(i => [i.number, i.idleDays])] }
    }
    case 'goodFirstIssues': {
      const g = shape(ctx, 'goodFirstIssues')
      if (!g) return null
      const count = activity?.open.goodFirstIssues ?? g.issues.length
      return { words: `${n(count)} good first issues`, numbers: [count, g.issues.length, ...g.issues.map(i => i.number)] }
    }
    case 'biggestOpenPr': {
      const pull = shape(ctx, 'biggestOpenPr')?.pull
      return pull ? { words: `#${pull.number}`, numbers: [pull.number, pull.additions, pull.deletions, pull.additions + pull.deletions, pull.changedFiles] } : null
    }
    case 'blockingPrs': {
      const b = shape(ctx, 'blockingPrs')
      if (!b) return null
      const words = b.milestone ? `${n(b.pulls.length)} open on ${b.milestone.title}` : `${n(b.pulls.length)} ready pull requests by wait`
      const milestone = b.milestone ? [b.milestone.open, b.milestone.closed, b.milestone.open + b.milestone.closed] : []
      return { words, numbers: [b.pulls.length, ...milestone, ...b.pulls.flatMap(p => [p.number, ...days(p.waitingMs)])] }
    }
    case 'commitsBetweenTags': {
      const c = shape(ctx, 'commitsBetweenTags')
      if (!c) return null
      const authors = new Set(c.commits.flatMap(x => (x.author && !x.author.isBot ? [x.author.login] : []))).size
      return { words: `${c.base} to ${c.head}`, numbers: [c.commits.length, c.totals.changedFiles, c.totals.additions, c.totals.deletions, authors] }
    }
    case 'busiestHour': {
      const b = shape(ctx, 'busiestHour')
      return b ? { words: `busiest hour ${String(b.hour).padStart(2, '0')}:00`, numbers: [b.hour, 0, b.commits] } : null
    }
    case 'quietestDay': {
      const q = shape(ctx, 'quietestDay')
      return q ? { words: `quietest day ${q.name}`, numbers: [q.commits] } : null
    }
    case 'mergedByDay': {
      const m = shape(ctx, 'mergedByDay')
      if (!m) return null
      const pulls = m.days.flatMap(d => d.pulls)
      return { words: `${n(pulls.length)} merged in 7 days`, numbers: [pulls.length, 7, m.days.length, ...m.days.map(d => d.pulls.length), ...pulls.map(p => p.number)] }
    }
    case 'contributorShare': {
      const c = shape(ctx, 'contributorShare')
      if (!c) return null
      const bf = busFactor(c.commits)
      return {
        words: `${n(c.commits.length)} committers in 90 days`,
        numbers: [90, c.commits.length, c.reviews.length, bf.factor, bf.total, ...[...c.commits, ...c.reviews].flatMap(x => [x.count, x.share * 100])],
      }
    }
    case 'monthCompare': {
      const m = shape(ctx, 'monthCompare')
      if (!m) return null
      const values = [m.previous, m.current].flatMap(x => Object.values(x.values).filter((v): v is number => v !== null))
      return { words: `${m.previous.month} and ${m.current.month}`, numbers: values }
    }
    case 'community': {
      const c = shape(ctx, 'community')
      if (!c) return null
      const files = Object.values(c.files)
      return { words: `community profile at ${c.healthPercentage}%`, numbers: [c.healthPercentage, files.filter(Boolean).length, files.length] }
    }
    case 'releases': {
      const r = shape(ctx, 'releases')
      if (!r) return null
      return { words: r.releases[0] ? `latest release ${r.releases[0].tag}` : 'no releases', numbers: [r.releases.length, r.tags.length] }
    }
    case 'commits': {
      const c = shape(ctx, 'commits')
      return c ? { words: `commits since ${shortDate(c.since, ctx.timeZone)}`, numbers: [c.commits.length] } : null
    }
    case 'stats.commitActivity': {
      const c = shape(ctx, 'stats.commitActivity')
      if (!c) return null
      const last12 = c.weeks.slice(-12).map(w => w.total)
      return { words: 'commits by week', numbers: [...seriesFacts(last12), last12.reduce((a, b) => a + b, 0), c.weeks.reduce((a, w) => a + w.total, 0), c.weeks.length] }
    }
    case 'stats.contributors': {
      const c = shape(ctx, 'stats.contributors')
      return c ? { words: `${n(c.authors.length)} top authors`, numbers: [c.authors.length] } : null
    }
    case 'stats.participation': {
      const p = shape(ctx, 'stats.participation')
      return p ? { words: 'commits by week', numbers: [...p.all, ...p.owner, p.all.length] } : null
    }
    case 'stats.punchCard':
      return ctx.shapes['stats.punchCard'] ? { words: 'the punch card', numbers: [] } : null
    case 'prFiles': {
      const p = shape(ctx, 'prFiles')
      return p ? { words: `files in #${p.number}`, numbers: [p.number, p.files.length, ...p.files.flatMap(f => [f.additions, f.deletions])] } : null
    }
    default:
      return ctx.shapes[name] ? { words: name, numbers: [] } : null
  }
}

/** A key as the model may spell it: a measure id, a shape name, or a shape name in kebab case ("workflow-runs"). */
function resolveKey(key: string): MeasureId | ShapeName | null {
  if (isMeasureId(key) || isShapeName(key)) return key
  const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  return isShapeName(camel) ? camel : null
}

/** The source line's words and the citable figures for every key the sentence names. */
export function sourceMapFor(ctx: DataContext, keys: readonly string[]): Record<string, InsightSource> {
  const out: Record<string, InsightSource> = {}
  for (const key of keys) {
    const resolved = resolveKey(key)
    const source = resolved === null ? null : isMeasureId(resolved) ? measureSource(ctx, resolved) : shapeSource(ctx, resolved)
    out[key] = source ?? { words: key, numbers: [] }
  }
  return out
}

/** Where a cited measure's lists start, when they start inside its window ("since Oct 1"). */
function coverageFacts(ctx: DataContext, keys: readonly string[]): string[] {
  const facts = keys.flatMap(key => {
    const covered = isMeasureId(key) ? measureOf(ctx, key)?.coveredFrom : undefined
    return covered ? [`since ${shortDate(covered, ctx.timeZone)}`] : []
  })
  return [...new Set(facts)]
}

export const bindInsight: Binder<InsightModelProps> = (ctx, props, extras = {}) => {
  const keys = props.sources.map(s => s.key)
  const facts = coverageFacts(ctx, keys)
  const boundProps: InsightProps = { ...props, sourceMap: sourceMapFor(ctx, keys), ...(facts.length ? { facts } : {}) }
  return bound('Insight', props, boundProps, extras)
}

const MAX_SENTENCE = 120

/**
 * A plain sentence from the measures named, for a template to show before the fill step writes one. Every
 * figure in it is a measure's value, so it always passes number validation. Measures with no value are skipped.
 */
export function systemInsight(ctx: DataContext, keys: readonly MeasureId[]): InsightModelProps {
  const parts: { key: MeasureId; words: string }[] = []
  const join = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`)
  for (const key of keys) {
    if (parts.length === 4) break
    const result = measureOf(ctx, key)
    if (!result) continue
    const next = [...parts.map(p => p.words), measureWords(result)]
    if (join(next).length + 1 > MAX_SENTENCE) break
    parts.push({ key, words: measureWords(result) })
  }
  if (!parts.length) return { sentence: `Here is what the data shows for \`${ctx.repo.owner}/${ctx.repo.name}\`.`, sources: [{ key: 'repo' }] }
  const text = join(parts.map(p => p.words))
  return { sentence: `${text.charAt(0).toUpperCase()}${text.slice(1)}.`, sources: parts.map(p => ({ key: p.key })) }
}
