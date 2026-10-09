import { action, asks, bind, insight, inWords, lineChart, metric, milestoneTitle, plural, refs, slotsFor, value } from '../build'
import { pieces, regions, type Template } from '../template'

export const releaseBlockers: Template = {
  id: 'release-blockers',
  density: 'comfortable',
  compose(ctx) {
    const milestone = milestoneTitle(ctx)
    const scope = milestone ? { milestone } : undefined
    const branch = ctx.repo.defaultBranch
    const waiting = ctx.shapes.blockingPrs?.pulls.filter(p => p.firstHumanReviewAt === null && !p.draft).map(p => p.number) ?? []
    const failing = value(ctx, 'failing-checks') ?? 0
    const targets = refs(waiting)
    const r = regions({
      insight: [insight(ctx, milestone ? ['awaiting-review', 'failing-checks', 'milestone-issues-open', 'milestone-closes'] : ['awaiting-review', 'failing-checks', 'open-prs'], failing > 0 ? 'warn' : undefined)],
      metrics: pieces(
        metric(ctx, 'open-prs', scope ? { scope: milestone } : {}),
        metric(ctx, 'awaiting-review', { hot: (value(ctx, 'awaiting-review') ?? 0) > 0 }),
        metric(ctx, 'failing-checks', { hot: failing > 0 }, { ask: `Which checks are failing on ${branch}?` }),
        milestone && metric(ctx, 'milestone-issues-open'),
      ),
      main: [
        bind(ctx, 'StatusList', {
          kind: 'pull',
          title: milestone ? `Pull requests on ${milestone}`.slice(0, 48) : 'Waiting longest for review',
          meta: 'sorted by wait',
          ...(scope ? { scope } : {}),
          sort: 'wait',
          limit: 5,
        }),
      ],
      side: [lineChart(ctx, { title: 'CI duration', meta: 'p50 · last 12 weeks', series: [{ measure: 'ci-p50', name: 'p50' }], failures: true, window: '12w' })],
      action: targets.length
        ? [
            action(ctx, {
              heading: `Ask for the ${inWords(targets.length)} missing ${targets.length === 1 ? 'review' : 'reviews'}`,
              body: `Requests a review on ${plural(targets.length, 'pull request')} still waiting on a first one. Nothing merges.`,
              primary: 'Request reviews',
              effect: { kind: 'request-review', targets },
            }),
          ]
        : [],
    })
    return { density: 'comfortable', regions: r, asks: asks('ci-trend', 'responsiveness', 'contributors', 'merged-recent'), slots: slotsFor(Object.values(r).flat()) }
  },
}
