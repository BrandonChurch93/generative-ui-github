import { cached, cacheKey, LIVE_TTL_SECONDS, type Cache } from './cache/cache'
import { computeMeasure, measureNeeds, type MeasureScope } from './compute'
import {
  biggestOpenPr,
  blockingPrs,
  busiestHour,
  ciDurationByWeek,
  commitsBetweenTags,
  contributorShare,
  failureRateByWeek,
  goodFirstIssues,
  mergedByDay,
  monthCompare,
  quietestDay,
  slowestJob,
  slowestRun,
  staleIssues,
} from './derived'
import { fetchActivity, fetchIssues, fetchMilestones, fetchPulls, fetchRepo } from './fetchers/graphql'
import {
  fetchChecks,
  fetchCommits,
  fetchCommunity,
  fetchCompare,
  fetchPrFiles,
  fetchReadme,
  fetchReleases,
  fetchRunTiming,
  fetchTree,
  fetchWorkflowRunsByWeek,
} from './fetchers/rest'
import { checkStats, STAT_ID, type StatShapeName } from './fetchers/stats'
import type { GitHubClient } from './github/client'
import type { RepoRef } from './github/resolve'
import type { MeasureId, MeasureResult } from './measures'
import type { Cached, ISODate, ShapeMap, ShapeName, WarmingStatus } from './shapes'
import { estimateTokens, modelView } from './view'

const DAY = 86_400_000
/** How far back the commit list reaches: the longest window a template asks about. */
export const COMMITS_DAYS = 90
/** How many weeks of workflow runs the CI trend samples. */
export const RUN_WEEKS = 12

export interface ContextNeeds {
  shapes: readonly ShapeName[]
  measures: readonly MeasureId[]
  scope?: MeasureScope
}

export type CachedShapes = { [K in ShapeName]?: Cached<ShapeMap[K]> }

export interface DataContext {
  repo: { owner: string; name: string; defaultBranch: string; sha: string }
  /** The instant the context describes, and the viewer's zone: what every window and day grouping is read against. */
  now: number
  timeZone: string
  /** What the template asked for, so a binder can compute a measure it was not given. */
  scope?: MeasureScope
  /** Every shape read, each with when it was fetched. */
  shapes: CachedShapes
  measures: Partial<Record<MeasureId, MeasureResult | null>>
  /** Set while any stat the template needs is still being counted by GitHub. */
  warming: WarmingStatus | null
  /** Stats GitHub will never count for this repo, so the pieces they feed are left out. */
  unavailable: ShapeName[]
  /** What the model reads: compact, capped, under the token budget. */
  view: Record<string, unknown>
  tokens: number
  githubReads: number
}

export interface ContextOptions {
  now?: number
  /** The viewer's IANA zone, for the punch card and day grouping. */
  timeZone?: string
  /** 900 for a live repo, null (never) for a sample. */
  ttlSeconds?: number | null
  /** A sample repo: everything comes from the cache, and a stat that is not there is reported missing. */
  offline?: boolean
  /** The status the last check returned, while stats are warming. */
  warming?: WarmingStatus | null
}

/** What each derived or follow-on shape is computed or fetched from. */
export const DEPENDS: Partial<Record<ShapeName, ShapeName[]>> = {
  ciDurationByWeek: ['workflowRuns'],
  failureRateByWeek: ['workflowRuns'],
  runTiming: ['workflowRuns'],
  slowestJob: ['workflowRuns', 'runTiming'],
  staleIssues: ['issues'],
  goodFirstIssues: ['issues'],
  biggestOpenPr: ['pulls'],
  prFiles: ['biggestOpenPr'],
  blockingPrs: ['pulls', 'milestones'],
  compare: ['releases'],
  commitsBetweenTags: ['compare'],
  busiestHour: ['stats.punchCard'],
  quietestDay: ['stats.punchCard'],
  mergedByDay: ['pulls'],
  contributorShare: ['stats.contributors', 'pulls'],
  monthCompare: ['pulls', 'issues', 'workflowRuns', 'activity'],
}

/** The shapes asked for, every shape the measures read, and everything those are derived from. */
export function closure(needs: ContextNeeds): ShapeName[] {
  const out = new Set<ShapeName>(['repo'])
  const visit = (name: ShapeName) => {
    if (out.has(name) && name !== 'repo') return
    out.add(name)
    for (const dep of DEPENDS[name] ?? []) visit(dep)
  }
  for (const s of needs.shapes) visit(s)
  for (const m of needs.measures) for (const s of measureNeeds(m, needs.scope)) visit(s)
  if (needs.scope?.pr !== undefined) out.delete('biggestOpenPr')
  return [...out]
}

const isStat = (name: ShapeName): name is StatShapeName => name in STAT_ID
const oldest = (...times: (ISODate | undefined)[]) => times.filter((x): x is ISODate => x !== undefined).sort()[0]

/** A repo and a template's needs to everything the composer gets: the shapes, the measures, the warming status and the model's view. */
export async function buildContext(client: GitHubClient, cache: Cache, ref: RepoRef, needs: ContextNeeds, options: ContextOptions = {}): Promise<DataContext> {
  const now = options.now ?? Date.now()
  const timeZone = options.timeZone ?? 'UTC'
  const ttl = options.ttlSeconds === undefined ? LIVE_TTL_SECONDS : options.ttlSeconds
  const readsBefore = client.requests
  const wanted = closure(needs)

  const read = <T>(key: string, load: () => Promise<T>) => cached(cache, cacheKey.shape(ref, key), ttl, load)
  const repo = await read('repo', () => fetchRepo(client, ref))
  const sha = repo.value.defaultBranchSha
  const shapes: CachedShapes = { repo: { ...repo.value, cachedAt: repo.cachedAt } }

  const statNames = wanted.filter(isStat)
  const stats = statNames.length
    ? await checkStats(client, ref, statNames, options.warming, { cache, sha, timeZone, ttlSeconds: ttl, now: () => now, offline: options.offline })
    : { status: null, data: {}, unavailable: [] }
  Object.assign(shapes, stats.data)

  const pending = new Map<ShapeName, Promise<unknown>>()
  const get = <K extends ShapeName>(name: K): Promise<Cached<ShapeMap[K]> | undefined> => {
    if (shapes[name]) return Promise.resolve(shapes[name] as Cached<ShapeMap[K]>)
    if (isStat(name)) return Promise.resolve(undefined)
    if (!pending.has(name)) pending.set(name, load(name).then(v => ((shapes as Record<string, unknown>)[name] = v)))
    return pending.get(name) as Promise<Cached<ShapeMap[K]> | undefined>
  }
  const fetched = async <T>(key: string, f: () => Promise<T>) => {
    const r = await read(key, f)
    return { ...(r.value as object), cachedAt: r.cachedAt } as Cached<T>
  }
  const derive = <T>(value: T | null, ...from: ({ cachedAt: ISODate } | undefined)[]) =>
    value === null ? undefined : ({ ...(value as object), cachedAt: oldest(...from.map(f => f?.cachedAt)) ?? new Date(now).toISOString() } as Cached<T>)

  async function load(name: ShapeName): Promise<unknown> {
    const owner = { owner: repo.value.owner, name: repo.value.name }
    switch (name) {
      case 'pulls':
        return fetched(name, () => fetchPulls(client, owner))
      case 'issues':
        return fetched(name, () => fetchIssues(client, owner))
      case 'milestones':
        return fetched(name, () => fetchMilestones(client, owner))
      case 'activity':
        return fetched(name, () => fetchActivity(client, owner, { now: new Date(now) }))
      case 'releases':
        return fetched(name, () => fetchReleases(client, owner))
      case 'community':
        return fetched(name, () => fetchCommunity(client, owner))
      case 'readme':
        return fetched(name, () => fetchReadme(client, owner))
      case 'commits': {
        const since = new Date(now - COMMITS_DAYS * DAY).toISOString().slice(0, 10)
        const author = needs.scope?.author
        return fetched(`commits:${since}${author ? `:${author}` : ''}`, () => fetchCommits(client, owner, { since: `${since}T00:00:00Z`, author }))
      }
      case 'workflowRuns':
        return fetched(`workflowRuns:${RUN_WEEKS}w`, () => fetchWorkflowRunsByWeek(client, owner, { branch: repo.value.defaultBranch, weeks: RUN_WEEKS, now: new Date(now) }))
      case 'checks':
        return fetched(`checks:${sha}`, () => fetchChecks(client, owner, sha))
      case 'tree':
        return fetched(`tree:${sha}`, () => fetchTree(client, owner, sha))
      case 'runTiming': {
        const runs = await get('workflowRuns')
        const run = runs ? slowestRun(runs, { now }) : null
        return run ? fetched(`runTiming:${run.id}`, () => fetchRunTiming(client, owner, run.id)) : undefined
      }
      case 'compare': {
        const releases = await get('releases')
        // The last two stable releases; a repo that ships only prereleases (next.js's canaries) uses its last two of any kind.
        const all = releases?.releases ?? []
        const stable = all.filter(r => !r.prerelease)
        const [head, base] = (stable.length >= 2 ? stable : all).map(r => r.tag)
        return head && base ? fetched(`compare:${base}...${head}`, () => fetchCompare(client, owner, base, head)) : undefined
      }
      case 'prFiles': {
        const pr = needs.scope?.pr ?? (await get('biggestOpenPr'))?.pull?.number
        const pull = (await get('pulls'))?.open.find(p => p.number === pr)
        return pr ? fetched(`prFiles:${pr}`, () => fetchPrFiles(client, owner, pr, { changedFiles: pull?.changedFiles })) : undefined
      }
      case 'ciDurationByWeek': {
        const runs = await get('workflowRuns')
        return runs && derive(ciDurationByWeek(runs, { now, weeks: RUN_WEEKS }), runs)
      }
      case 'failureRateByWeek': {
        const runs = await get('workflowRuns')
        return runs && derive(failureRateByWeek(runs, { now, weeks: RUN_WEEKS }), runs)
      }
      case 'slowestJob': {
        const [runs, timing] = [await get('workflowRuns'), await get('runTiming')]
        const run = runs ? slowestRun(runs, { now }) : null
        return run && timing ? derive(slowestJob(run, timing), runs, timing) : undefined
      }
      case 'staleIssues': {
        const issues = await get('issues')
        return issues && derive(staleIssues(issues, { now }), issues)
      }
      case 'goodFirstIssues': {
        const issues = await get('issues')
        return issues && derive(goodFirstIssues(issues), issues)
      }
      case 'biggestOpenPr': {
        const pulls = await get('pulls')
        return pulls && derive(biggestOpenPr(pulls), pulls)
      }
      case 'blockingPrs': {
        const [pulls, milestones] = [await get('pulls'), await get('milestones')]
        return pulls && milestones ? derive(blockingPrs(pulls, milestones, { now }), pulls, milestones) : undefined
      }
      case 'commitsBetweenTags': {
        const compare = await get('compare')
        return compare && derive(commitsBetweenTags(compare), compare)
      }
      case 'busiestHour': {
        const punch = await get('stats.punchCard')
        return punch && derive(busiestHour(punch), punch)
      }
      case 'quietestDay': {
        const punch = await get('stats.punchCard')
        return punch && derive(quietestDay(punch), punch)
      }
      case 'mergedByDay': {
        const pulls = await get('pulls')
        return pulls && derive(mergedByDay(pulls, { now, days: 7, timeZone, window: '7d' }), pulls)
      }
      case 'contributorShare': {
        const [contributors, pulls] = [await get('stats.contributors'), await get('pulls')]
        return contributors && pulls ? derive(contributorShare(contributors, pulls, { now }), contributors, pulls) : undefined
      }
      case 'monthCompare': {
        const [pulls, issues, runs, activity] = [await get('pulls'), await get('issues'), await get('workflowRuns'), await get('activity')]
        return pulls && issues && runs ? derive(monthCompare(pulls, issues, runs, activity, { now }), pulls, issues, runs, activity) : undefined
      }
      default:
        return undefined
    }
  }

  await Promise.all(wanted.map(name => get(name)))
  for (const name of Object.keys(shapes) as ShapeName[]) if (shapes[name] === undefined) delete shapes[name]

  const cachedAt = Object.fromEntries(Object.entries(shapes).map(([k, v]) => [k, (v as { cachedAt: ISODate }).cachedAt]))
  const measureContext = { now, shapes: shapes as Partial<ShapeMap>, cachedAt, scope: needs.scope }
  const measures = Object.fromEntries(needs.measures.map(id => [id, computeMeasure(id, measureContext)])) as DataContext['measures']

  // The model reads what the template asked for, not every shape fetched along the way.
  const shown = Object.fromEntries(Object.entries(shapes).filter(([k]) => k === 'repo' || needs.shapes.includes(k as ShapeName)))
  const view = modelView({ shapes: shown as Partial<ShapeMap>, measures, now, timeZone })

  return {
    repo: { owner: repo.value.owner, name: repo.value.name, defaultBranch: repo.value.defaultBranch, sha },
    now,
    timeZone,
    ...(needs.scope ? { scope: needs.scope } : {}),
    shapes,
    measures,
    warming: stats.status,
    unavailable: stats.unavailable,
    view,
    tokens: estimateTokens(view),
    githubReads: client.requests - readsBefore,
  }
}
