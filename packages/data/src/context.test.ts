import { beforeAll, describe, expect, it } from 'vitest'
import { memoryCache } from './cache/cache'
import { buildContext, type DataContext } from './context'
import { CONTEXT_NOW, CONTEXT_ZONE, EVERYTHING, NEXT } from './context.record'
import { createGitHubClient } from './github/client'
import { fixtureClient, loadRecording } from './github/fixtures'
import { replayFetch } from './github/recording'
import { MEASURE_IDS, MEASURES } from './measures'

const build = (client: ReturnType<typeof fixtureClient>['client']) =>
  buildContext(client, memoryCache({ now: () => CONTEXT_NOW }), NEXT, EVERYTHING, { now: CONTEXT_NOW, timeZone: CONTEXT_ZONE })

let ctx: DataContext
let misses: string[]
beforeAll(async () => {
  const replay = fixtureClient('context-nextjs')
  misses = replay.misses
  ctx = await build(replay.client)
})

describe('measures on the next.js fixture', () => {
  it('computes every measure, each sane: the right unit, non-negative, formatted', () => {
    expect(misses).toEqual([])
    expect(Object.keys(ctx.measures).sort()).toEqual([...MEASURE_IDS].sort())
    // next.js has one open milestone, "backlog", with no due date: no release milestone, so no figure. Not a zero.
    const missing = MEASURE_IDS.filter(id => ctx.measures[id] === null)
    expect(missing).toEqual(['milestone-issues-open', 'milestone-closes'])
    for (const id of MEASURE_IDS) {
      const m = ctx.measures[id]
      if (!m) continue
      expect(m.unit, id).toBe(MEASURES[id].unit)
      expect(m.formatted.text, id).not.toBe('')
      const numbers = typeof m.value === 'object' ? [m.value.count, m.value.total] : typeof m.value === 'number' ? [m.value] : []
      for (const n of numbers) expect(Number.isFinite(n) && n >= 0, `${id} ${n}`).toBe(true)
      if (m.series12w) expect(m.series12w, id).toHaveLength(12)
    }
    expect(ctx.measures['failing-checks']!.value).toEqual({ count: 57, total: 421 })
    expect(ctx.measures['open-prs']!.value).toBe(2524)
    expect(ctx.measures['ci-p50']!.formatted).toEqual({ text: '11.3', suffix: 'min' })
    expect(ctx.measures['busiest-hour']!.formatted.text).toBe('16:00')
    // The merged list reaches back only days on next.js, so a 30-day median says where its data starts.
    expect(ctx.measures['review-wait-median']!.coveredFrom).toBeDefined()
    expect(ctx.measures['review-wait-median']!.series12w).toBeUndefined()
  })
})

describe('derived shapes on the next.js fixture', () => {
  it('reads CI as build-and-test, twelve weeks of it, and finds its slowest job', () => {
    const { ciDurationByWeek: ci, failureRateByWeek: rate, slowestJob } = ctx.shapes
    expect(ci!.workflow).toBe('build-and-test')
    expect(ci!.weeks).toHaveLength(12)
    expect(ci!.weeks.every(w => w.p50Ms > 0 && w.p90Ms >= w.p50Ms && w.failures <= w.count)).toBe(true)
    expect(rate!.weeks.every(w => w.rate >= 0 && w.rate <= 1)).toBe(true)
    expect(slowestJob).toMatchObject({ workflowName: 'build-and-test', job: 'test dev (3/10, 18.3.1) / build', durationMs: 1_708_000 })
  })

  it('sorts stale issues by idle time and finds the biggest open pull request', () => {
    const stale = ctx.shapes.staleIssues!.issues
    expect(stale.every(i => i.idleDays >= 30)).toBe(true)
    expect(stale.map(i => i.idleDays)).toEqual([...stale.map(i => i.idleDays)].sort((a, b) => b - a))
    expect(ctx.shapes.goodFirstIssues!.issues.every(i => i.labels.some(l => /good.first|help.wanted/i.test(l)))).toBe(true)
    const big = ctx.shapes.biggestOpenPr!.pull!
    expect([big.number, big.additions + big.deletions]).toEqual([99178, 2454])
  })

  it('takes the open ready pull requests as blocking when no milestone has a due date, longest wait first', () => {
    const { milestone, pulls } = ctx.shapes.blockingPrs!
    expect(milestone).toBeNull()
    expect(pulls).toHaveLength(20)
    expect(pulls.every(p => !p.draft)).toBe(true)
    expect(pulls.map(p => p.waitingMs)).toEqual([...pulls.map(p => p.waitingMs)].sort((a, b) => b - a))
  })

  it('compares the last two releases, canaries when there is no stable pair', () => {
    expect(ctx.shapes.commitsBetweenTags).toMatchObject({ base: 'v16.5.0-canary.4', head: 'v16.5.0-canary.5' })
    expect(ctx.shapes.commitsBetweenTags!.commits).toHaveLength(4)
  })

  it('finds the busiest hour and quietest day in the viewer zone, and groups merges by local day', () => {
    expect(ctx.shapes.busiestHour).toMatchObject({ hour: 16, timeZone: CONTEXT_ZONE })
    expect(ctx.shapes.quietestDay).toMatchObject({ day: 6, name: 'Sunday' })
    const days = ctx.shapes.mergedByDay!.days
    expect(days[0]!.date).toBe('2026-10-08')
    expect(days.map(d => d.date)).toEqual([...days.map(d => d.date)].sort().reverse())
  })

  it('ranks commit and review share over 90 days, bots out, and compares the months with exact merge counts', () => {
    const { commits, reviews } = ctx.shapes.contributorShare!
    for (const list of [commits, reviews]) {
      expect(list.every(x => !x.author.isBot)).toBe(true)
      expect(list.map(x => x.count)).toEqual([...list.map(x => x.count)].sort((a, b) => b - a))
      expect(list.reduce((n, x) => n + x.share, 0)).toBeCloseTo(1, 6)
    }
    expect(commits[0]!.author.login).toBe('sokra')
    const { current, previous } = ctx.shapes.monthCompare!
    expect([current.month, previous.month]).toEqual(['October 2026', 'September 2026'])
    expect([current.values['prs-merged'], previous.values['prs-merged']]).toEqual([156, 462])
    // The lists do not reach back over September, so its medians are unknown, not zero.
    expect(previous.values['review-wait-median']).toBeNull()
  })
})

describe('data context', () => {
  it('dates every shape and reports no warming when the stats are in', () => {
    for (const [name, shape] of Object.entries(ctx.shapes)) expect(Date.parse((shape as { cachedAt: string }).cachedAt), name).not.toBeNaN()
    expect(ctx.warming).toBeNull()
    expect(ctx.unavailable).toEqual(['stats.codeFrequency'])
    expect(ctx.githubReads).toBe(39)
  })

  it('reports WarmingStatus, and leaves out what the cold stats feed, when GitHub is still counting', async () => {
    const recording = loadRecording('context-nextjs')
    for (const r of recording.responses) if (r.key.includes('/stats/')) Object.assign(r, { status: 202, body: {} })
    const cold = await build(createGitHubClient({ token: 'replay', fetch: replayFetch(recording) }))
    expect(cold.warming).toMatchObject({ repo: 'vercel/next.js', phase: 'warming', attempt: 1, nextCheckMs: 4000 })
    expect(cold.warming!.stats.map(s => s.state)).not.toContain('ready')
    expect(cold.shapes.busiestHour).toBeUndefined()
    expect(cold.shapes['stats.punchCard']).toBeUndefined()
    expect(cold.shapes.pulls).toBeDefined()
  })
})
