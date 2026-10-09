import { isBot } from './chaoss'
import { localDate, prSize } from './derived'
import { MEASURES, type MeasureId, type MeasureResult } from './measures'
import type { ISODate, Issue, Pull, ShapeMap, ShapeName } from './shapes'

// What the model reads: the measures, and each shape cut to the few facts a sentence could cite. The full
// shapes stay with the system, which binds them to the pieces; the model only names them.

const DAY = 86_400_000
/** Rows per list the model sees. Enough to write about, few enough to stay under the token budget. */
export const VIEW_ROWS = 6
const TITLE = 72

const clip = (s: string, n = TITLE) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const days = (from: ISODate, now: number) => Math.round(((now - Date.parse(from)) / DAY) * 10) / 10
const who = (p: { author: { login: string } | null }) => p.author?.login ?? 'ghost'

function pullRow(p: Pull, now: number) {
  return { n: p.number, title: clip(p.title), by: who(p), open_d: days(p.createdAt, now), size: prSize(p), review: p.reviewDecision ?? 'none', ...(p.draft ? { draft: true } : {}) }
}

function issueRow(i: Issue, now: number) {
  return { n: i.number, title: clip(i.title), labels: i.labels.slice(0, 3), idle_d: days(i.updatedAt, now), comments: i.comments }
}

type Views = { [K in ShapeName]?: (shape: ShapeMap[K], now: number, timeZone: string) => unknown }

const VIEWS: Views = {
  repo: r => ({ repo: `${r.owner}/${r.name}`, about: r.description ? clip(r.description, 120) : null, stars: r.stars, branch: r.defaultBranch, language: r.primaryLanguage }),
  pulls: (p, now) => ({
    open: p.open.length,
    drafts: p.open.filter(x => x.draft).length,
    oldest_open: [...p.open].filter(x => !isBot(x.author)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(0, VIEW_ROWS).map(x => pullRow(x, now)),
    merged_listed: p.merged.length,
  }),
  issues: (i, now) => ({ open_listed: i.open.length, closed_listed: i.closed.length, newest_open: i.open.slice(0, VIEW_ROWS).map(x => issueRow(x, now)) }),
  milestones: m => m.open.slice(0, 3).map(x => ({ title: x.title, due: x.dueOn?.slice(0, 10) ?? null, open: x.open, closed: x.closed })),
  checks: c => {
    const failing = c.runs.filter(r => r.conclusion === 'failure' || r.conclusion === 'timed_out')
    return { ref: c.ref.slice(0, 7), total: c.runs.length, failing: failing.slice(0, VIEW_ROWS).map(r => r.name) }
  },
  workflowRuns: w => ({ branch: w.branch, runs_listed: w.runs.length }),
  blockingPrs: (b, now) => ({
    milestone: b.milestone ? { title: b.milestone.title, due: b.milestone.dueOn?.slice(0, 10) ?? null, open: b.milestone.open, closed: b.milestone.closed } : null,
    pulls: b.pulls.slice(0, VIEW_ROWS).map(p => ({ ...pullRow(p, now), waiting_d: Math.round((b.pulls.find(x => x.number === p.number)!.waitingMs / DAY) * 10) / 10 })),
  }),
  ciDurationByWeek: c => ({ workflow: c.workflow, p50_min: c.weeks.map(w => Math.round(w.p50Ms / 6000) / 10), failures: c.weeks.map(w => w.failures) }),
  failureRateByWeek: f => ({ rate_pct: f.weeks.map(w => Math.round(w.rate * 1000) / 10) }),
  slowestJob: s => ({ workflow: s.workflowName, job: s.job, min: Math.round(s.durationMs / 6000) / 10 }),
  staleIssues: (s, now) => ({ count: s.issues.length, oldest: s.issues.slice(0, VIEW_ROWS).map(i => issueRow(i, now)) }),
  goodFirstIssues: (g, now) => ({ count: g.issues.length, newest: g.issues.slice(0, VIEW_ROWS).map(i => issueRow(i, now)) }),
  biggestOpenPr: (b, now) => (b.pull ? pullRow(b.pull, now) : null),
  prFiles: f => ({ n: f.number, files: f.files.length, truncated: f.truncated, largest: [...f.files].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions)).slice(0, VIEW_ROWS).map(x => x.path) }),
  commitsBetweenTags: c => ({ from: c.base, to: c.head, commits: c.commits.length, files: c.totals.changedFiles, additions: c.totals.additions, deletions: c.totals.deletions }),
  releases: r => r.releases.slice(0, 3).map(x => ({ tag: x.tag, date: x.publishedAt.slice(0, 10), pre: x.prerelease })),
  community: c => ({ health_pct: c.healthPercentage, ...c.files }),
  readme: r => ({ path: r.path, chars: r.text.length }),
  busiestHour: b => ({ hour: b.hour, commits: b.commits, zone: b.timeZone }),
  quietestDay: q => ({ day: q.name, commits: q.commits }),
  mergedByDay: m => ({ zone: m.timeZone, days: m.days.slice(0, 7).map(d => ({ date: d.date, merged: d.pulls.length, titles: d.pulls.slice(0, 3).map(p => clip(p.title, 56)) })) }),
  contributorShare: c => ({
    commits: c.commits.slice(0, VIEW_ROWS).map(x => ({ who: x.author.login, n: x.count, pct: Math.round(x.share * 1000) / 10 })),
    reviews: c.reviews.slice(0, VIEW_ROWS).map(x => ({ who: x.author.login, n: x.count, pct: Math.round(x.share * 1000) / 10 })),
  }),
  monthCompare: m => ({ [m.current.month]: m.current.values, [m.previous.month]: m.previous.values }),
  activity: a => ({ weeks: a.weeks.length, opened: a.weeks.reduce((n, w) => n + w.issuesOpened + w.pullsOpened, 0), closed: a.weeks.reduce((n, w) => n + w.issuesClosed + w.pullsClosed, 0) }),
  'stats.punchCard': p => ({ zone: p.timeZone, cells: p.cells.length }),
  'stats.participation': p => ({ last12_all: p.all.slice(-12) }),
  'stats.commitActivity': c => ({ last12_weekly: c.weeks.slice(-12).map(w => w.total) }),
  'stats.contributors': c => ({ authors_listed: c.authors.length }),
}

function measureView(results: Partial<Record<MeasureId, MeasureResult | null>>) {
  return Object.fromEntries(
    Object.entries(results).map(([id, r]) => [id, r ? { value: r.formatted.suffix ? `${r.formatted.text} ${r.formatted.suffix}` : r.formatted.text, ...(r.series12w ? { weekly: r.series12w.map(v => Math.round(v * 10) / 10) } : {}) } : { value: null, why: `no data for ${MEASURES[id as MeasureId].label.toLowerCase()}` }]),
  )
}

/** The model's view of a data context: compact JSON keyed by shape name, plus the measures. */
export function modelView(input: { shapes: Partial<ShapeMap>; measures: Partial<Record<MeasureId, MeasureResult | null>>; now: number; timeZone: string }): Record<string, unknown> {
  const view: Record<string, unknown> = { today: localDate(input.now, input.timeZone), measures: measureView(input.measures) }
  for (const [name, shape] of Object.entries(input.shapes) as [ShapeName, unknown][]) {
    const make = VIEWS[name] as ((s: unknown, now: number, zone: string) => unknown) | undefined
    if (make && shape !== undefined) view[name] = make(shape, input.now, input.timeZone)
  }
  return view
}

/**
 * A token estimate without a network call: about 3.2 characters per token for compact JSON with short keys,
 * which lands a little above what the count endpoint reports, so the budget check errs on the safe side.
 */
export function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 3.2)
}
