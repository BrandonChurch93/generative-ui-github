import { asks, bind, insight, lineChart, metric, repoName, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const overview: Template = {
  id: 'overview',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['open-prs', 'prs-merged', 'review-wait-median', 'contributors'])],
      metrics: pieces(
        metric(ctx, 'open-prs'),
        metric(ctx, 'prs-merged', { trend: true }),
        metric(ctx, 'review-wait-median', { trend: true }),
        metric(ctx, 'contributors'),
      ),
      main: [bind(ctx, 'StatusList', { kind: 'pull', title: 'Waiting longest for review', meta: 'open pull requests', sort: 'wait', limit: 5 })],
      side: [
        lineChart(ctx, { title: 'Commits per week', meta: `${repoName(ctx)} · last 12 weeks`, series: [{ measure: 'commits', name: 'Commits' }], window: '12w' }),
        bind(ctx, 'Checklist', { title: 'Community standards', source: 'community-standards' }),
      ],
    })
    return { density: 'comfortable', regions: r, asks: asks('release-blockers', 'contributors', 'ci-trend', 'new-contributor'), slots: slotsFor(Object.values(r).flat()) }
  },
}
