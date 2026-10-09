import {
  failed,
  goodFirstIssues,
  isBot,
  median,
  prSize,
  staleIssues,
  timedRuns,
  waitingMs,
  weekStarts,
  windowSpan,
  type CheckRun,
  type Issue,
  type Pull,
  type WorkflowRun,
} from '@genui-github/data'
import type { ErrorInfo } from '@genui-github/ui'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { ago, during, missingData, ref, sha7, shape, span } from './group-a-shared'
import { WINDOW_WORDS, type StatusItem, type StatusListModelProps, type StatusListProps, type StatusScope, type StatusSort, type Window } from './group-a-ui'

// StatusList: the model picks the kind, the scope and the sort; the system reads the items, sorts them, maps
// each to its state (the component writes the tag words for it) and writes every meta line.

export const DEFAULT_STATUS_LIMIT = 5
const WEEK = 7 * 86_400_000

const SORT_WORDS: Record<StatusSort, string> = {
  wait: 'sorted by wait',
  age: 'oldest first',
  activity: 'longest idle first',
  size: 'largest first',
  duration: 'slowest first',
}

type Listing = { items: StatusItem[]; meta: string; empty: string; emptyMeta?: string } | { missing: ErrorInfo }

const t = Date.parse
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const inWindow = (ctx: DataContext, iso: string, window: Window | undefined) => {
  if (!window) return true
  const { from, to } = windowSpan(window, ctx.now)
  return t(iso) >= from && t(iso) <= to
}
const offBranch = (ctx: DataContext, scope: StatusScope) => scope.branch !== undefined && scope.branch !== ctx.repo.defaultBranch

/** One note on a sample: the lists hold the most recently updated items, so a list that is not the whole says how many it read. */
const listed = (shown: number, exact: number | undefined) => (exact !== undefined && exact > shown ? ` · ${shown} listed` : '')

function pullState(p: Pull): StatusItem<'pull'>['state'] {
  if (p.draft) return 'draft'
  if (p.reviewDecision === 'CHANGES_REQUESTED') return 'changes'
  if (p.reviewDecision === 'APPROVED') return 'approved'
  // `failing` needs the pull's own check runs, which no shape holds; only the default branch head's are read.
  return 'pending'
}

function pullListing(ctx: DataContext, props: StatusListModelProps): Listing {
  const scope = props.scope ?? {}
  const sort = props.sort === 'duration' || !props.sort ? 'wait' : props.sort
  const pulls = shape(ctx, 'pulls')
  const blocking = shape(ctx, 'blockingPrs')
  const narrowed = scope.milestone || scope.author || scope.labels || scope.pr || scope.window || offBranch(ctx, scope)
  let pool: Pull[]
  let note = ''
  if (!narrowed && sort === 'wait' && blocking) {
    pool = blocking.pulls
    note = blocking.milestone ? ` · ${blocking.milestone.title}` : ' · ready for review'
  } else if (pulls) {
    pool = pulls.open.filter(
      p =>
        !isBot(p.author) &&
        (!scope.pr || p.number === scope.pr) &&
        (!scope.milestone || p.milestone === scope.milestone) &&
        (!scope.author || same(p.author.login, scope.author)) &&
        (!scope.labels || p.labels.some(l => scope.labels!.some(x => same(l, x)))) &&
        (!offBranch(ctx, scope) || p.headRef === scope.branch) &&
        inWindow(ctx, p.createdAt, scope.window),
    )
    note = listed(pulls.open.length, shape(ctx, 'activity')?.open.pulls)
  } else {
    return { missing: missingData(ctx, "Couldn't load pull requests", ['pulls']) }
  }

  const wait = (p: Pull) => waitingMs(p, ctx.now)
  const order: Record<typeof sort, (a: Pull, b: Pull) => number> = {
    wait: (a, b) => wait(b) - wait(a),
    age: (a, b) => t(a.createdAt) - t(b.createdAt),
    activity: (a, b) => t(a.updatedAt) - t(b.updatedAt),
    size: (a, b) => prSize(b) - prSize(a),
  }
  const fact = (p: Pull) =>
    sort === 'wait' ? `waiting ${span(wait(p))}` : sort === 'activity' ? `updated ${ago(p.updatedAt, ctx.now)}` : `opened ${ago(p.createdAt, ctx.now)}`
  const items = [...pool].sort(order[sort]).map(
    (p): StatusItem<'pull'> => ({
      id: String(p.number),
      title: p.title,
      meta: `${ref(p.number)} · ${p.author.login} · ${fact(p)}`,
      state: pullState(p),
      value: { add: p.additions, del: p.deletions },
      ask: `What's holding ${ref(p.number)}?`,
      url: p.url,
    }),
  )
  const last = pulls?.merged.find(p => p.mergedAt)
  const where = scope.milestone ? ` on ${scope.milestone}` : scope.author ? ` by ${scope.author}` : narrowed ? ' match' : ''
  return {
    items,
    meta: `${SORT_WORDS[sort]}${note}`,
    empty: `No open pull requests${where}`,
    ...(last?.mergedAt ? { emptyMeta: `last merged ${ago(last.mergedAt, ctx.now)} · ${ref(last.number)}` } : {}),
  }
}

function issueListing(ctx: DataContext, props: StatusListModelProps): Listing {
  const scope = props.scope ?? {}
  const sort = props.sort ?? 'age'
  const issues = shape(ctx, 'issues')
  if (!issues) return { missing: missingData(ctx, "Couldn't load issues", ['issues']) }
  const stale = new Set((shape(ctx, 'staleIssues') ?? staleIssues(issues, { now: ctx.now })).issues.map(i => i.number))
  const first = new Set((shape(ctx, 'goodFirstIssues') ?? goodFirstIssues(issues)).issues.map(i => i.number))
  const state = (i: Issue): StatusItem<'issue'>['state'] =>
    stale.has(i.number) ? 'stale' : first.has(i.number) ? 'good-first' : i.assignees.length ? 'assigned' : 'open'
  // A branch does not narrow issues: they have none.
  const pool = issues.open.filter(
    i =>
      !isBot(i.author) &&
      (!scope.pr || i.number === scope.pr) &&
      (!scope.milestone || i.milestone === scope.milestone) &&
      (!scope.author || same(i.author.login, scope.author)) &&
      (!scope.labels || i.labels.some(l => scope.labels!.some(x => same(l, x)))) &&
      inWindow(ctx, i.createdAt, scope.window),
  )
  const unanswered = (i: Issue) => (i.firstHumanCommentAt === null ? 0 : 1)
  const order: Record<StatusSort, (a: Issue, b: Issue) => number> = {
    age: (a, b) => t(a.createdAt) - t(b.createdAt),
    duration: (a, b) => t(a.createdAt) - t(b.createdAt),
    activity: (a, b) => t(a.updatedAt) - t(b.updatedAt),
    wait: (a, b) => unanswered(a) - unanswered(b) || t(a.createdAt) - t(b.createdAt),
    size: (a, b) => b.comments - a.comments,
  }
  const fact = (i: Issue) => {
    if (sort === 'activity') return `idle ${span(ctx.now - t(i.updatedAt))}`
    if (sort === 'wait') return i.firstHumanCommentAt ? `answered after ${span(t(i.firstHumanCommentAt) - t(i.createdAt))}` : `no reply in ${span(ctx.now - t(i.createdAt))}`
    return `opened ${ago(i.createdAt, ctx.now)}`
  }
  const items = [...pool].sort(order[sort]).map(
    (i): StatusItem<'issue'> => ({
      id: String(i.number),
      title: i.title,
      meta: `${ref(i.number)} · ${i.author.login} · ${fact(i)}`,
      state: state(i),
      value: { comments: i.comments },
      url: i.url,
    }),
  )
  const where = scope.labels ? ` labeled ${scope.labels.join(', ')}` : scope.milestone ? ` on ${scope.milestone}` : scope.author ? ` by ${scope.author}` : ''
  return { items, meta: `${SORT_WORDS[sort]}${listed(issues.open.length, shape(ctx, 'activity')?.open.issues)}`, empty: `No open issues${where}` }
}

function checkState(r: CheckRun): StatusItem<'check'>['state'] {
  if (r.status !== 'completed') return 'running'
  if (r.conclusion === 'timed_out') return 'timeout'
  if (failed(r)) return 'failed'
  if (r.conclusion === 'success') return 'passed'
  return 'skipped'
}

const CHECK_RANK: Record<StatusItem<'check'>['state'], number> = { failed: 0, timeout: 1, running: 2, passed: 3, skipped: 4 }

function checkListing(ctx: DataContext, props: StatusListModelProps): Listing {
  const scope = props.scope ?? {}
  const branch = ctx.repo.defaultBranch
  if (scope.pr) return { missing: { failed: "Couldn't load checks", cause: `Checks on ${ref(scope.pr)} are not in this answer's data` } }
  if (offBranch(ctx, scope)) return { missing: { failed: "Couldn't load checks", cause: `Only ${branch} is in this answer's data` } }
  const checks = shape(ctx, 'checks')
  if (!checks) return { missing: missingData(ctx, "Couldn't load checks", ['checks']) }
  const minutes = (r: CheckRun) => (r.startedAt && r.completedAt ? Math.round((t(r.completedAt) - t(r.startedAt)) / 6_000) / 10 : null)
  const seen = new Map<string, number>()
  const rows = checks.runs.map(r => {
    const n = (seen.get(r.name) ?? 0) + 1
    seen.set(r.name, n)
    return { run: r, id: n > 1 ? `${r.name} (${n})` : r.name, state: checkState(r), minutes: minutes(r) }
  })
  const by = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    props.sort === 'age' ? t(a.run.startedAt ?? '') - t(b.run.startedAt ?? '') : (b.minutes ?? -1) - (a.minutes ?? -1)
  rows.sort((a, b) => CHECK_RANK[a.state] - CHECK_RANK[b.state] || by(a, b))
  const items = rows.map(
    ({ run, id, state, minutes: m }): StatusItem<'check'> => ({
      id,
      title: run.name,
      meta: run.completedAt ? `finished ${ago(run.completedAt, ctx.now)}` : run.startedAt ? `started ${ago(run.startedAt, ctx.now)}` : 'queued',
      state,
      ...(m !== null ? { value: { durationMin: m } } : {}),
    }),
  )
  const failing = rows.filter(r => r.state === 'failed' || r.state === 'timeout').length
  return {
    items,
    meta: `${failing} of ${checks.runs.length} failing · ${branch} ${sha7(checks.ref)}${checks.truncated ? ' · partial' : ''}`,
    empty: `No check runs on ${branch} head`,
  }
}

function workflowListing(ctx: DataContext, props: StatusListModelProps): Listing {
  const scope = props.scope ?? {}
  const runs = shape(ctx, 'workflowRuns')
  if (!runs) return { missing: missingData(ctx, "Couldn't load workflow runs", ['workflowRuns']) }
  if (scope.branch && scope.branch !== runs.branch) return { missing: { failed: "Couldn't load workflow runs", cause: `Only ${runs.branch} is in this answer's data` } }
  const window = scope.window ?? '30d'
  const { from, to } = windowSpan(window, ctx.now)
  const counts = (r: WorkflowRun) => r.status === 'completed' && r.conclusion !== null && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped'
  const groups = new Map<string, WorkflowRun[]>()
  for (const r of runs.runs) groups.set(r.workflowName, [...(groups.get(r.workflowName) ?? []), r])

  const weeks = weekStarts(ctx.now, 12)
  const rows = [...groups].flatMap(([name, all]) => {
    const inside = all.filter(r => counts(r) && t(r.runStartedAt) >= from && t(r.runStartedAt) <= to)
    if (!inside.length) return []
    const p50 = median(timedRuns(inside).map(r => r.durationMs))
    const failRate = inside.filter(failed).length / inside.length
    const flaky = inside.filter(r => r.runAttempt > 1 && r.conclusion === 'success').length / inside.length
    const latest = [...all].sort((a, b) => t(b.runStartedAt) - t(a.runStartedAt))[0]!
    // A run that passed only on a retry, in one of ten runs or more, is flaky rather than passing.
    const state: StatusItem<'workflow'>['state'] = latest.status !== 'completed' ? 'queued' : failed(latest) ? 'failing' : flaky >= 0.1 ? 'flaky' : 'passing'
    const timed = timedRuns(all.filter(counts))
    const weekly = weeks.map(start => median(timed.filter(r => t(r.runStartedAt) >= start && t(r.runStartedAt) < start + WEEK).map(r => r.durationMs)))
    const trend = weekly.every((w): w is number => w !== null) ? weekly.map(w => Math.round(w / 6_000) / 10) : undefined
    const p50Min = p50 === null ? null : Math.round(p50 / 6_000) / 10
    return [{ name, runs: inside.length, p50Min, failRate, state, trend }]
  })
  rows.sort((a, b) => (props.sort === 'duration' ? (b.p50Min ?? -1) - (a.p50Min ?? -1) : b.failRate - a.failRate) || b.runs - a.runs)
  const items = rows.map(
    (r): StatusItem<'workflow'> => ({
      id: r.name,
      title: r.name,
      meta: `${r.runs} ${r.runs === 1 ? 'run' : 'runs'} · ${Math.round(r.failRate * 100)}% failed`,
      state: r.state,
      ...(r.p50Min !== null ? { value: { p50Min: r.p50Min, failRate: r.failRate } } : {}),
      ...(r.trend ? { trend: r.trend } : {}),
    }),
  )
  return { items, meta: `${WINDOW_WORDS[window]} · ${runs.branch}`, empty: `No workflow runs ${during(WINDOW_WORDS[window])}` }
}

const LISTINGS = { pull: pullListing, issue: issueListing, check: checkListing, workflow: workflowListing } as const

export const bindStatusList: Binder<StatusListModelProps> = (ctx, props, extras = {}) => {
  const listing = LISTINGS[props.kind](ctx, props)
  const frame: StatusListProps = { kind: props.kind, title: props.title, items: [], ...(props.meta ? { meta: props.meta } : {}) }
  if ('missing' in listing) return unavailable('StatusList', props, frame, listing.missing, extras)
  const meta = props.meta ?? listing.meta
  const items = listing.items.slice(0, props.limit ?? DEFAULT_STATUS_LIMIT)
  if (!items.length) {
    return empty(
      'StatusList',
      props,
      { ...frame, meta, empty: props.empty ?? listing.empty, emptyTone: props.emptyTone ?? 'neutral', ...(listing.emptyMeta ? { emptyMeta: listing.emptyMeta } : {}) },
      extras,
    )
  }
  return bound('StatusList', props, { ...frame, meta, items, ...(props.emptyTone ? { emptyTone: props.emptyTone } : {}) } satisfies StatusListProps, extras)
}
