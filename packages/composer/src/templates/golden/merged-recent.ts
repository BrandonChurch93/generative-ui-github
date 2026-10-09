import { asks, bind, insight, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const mergedRecent: Template = {
  id: 'merged-recent',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      // The contributors figure in the context is the 90-day one; this week's is the metric's, so the answer leads with merges.
      insight: [insight(ctx, ['prs-merged', 'review-wait-median'])],
      metrics: pieces(metric(ctx, 'prs-merged', { trend: true }), metric(ctx, 'contributors', { window: '7d' })),
      main: [bind(ctx, 'Timeline', { title: 'Merged this week', meta: 'last 7 days', kind: 'merged', scope: { window: '7d' }, limit: 8, dayAsk: 'What merged on {day}?' })],
      side: [bind(ctx, 'PersonList', { measure: 'commits', limit: 5 })],
    })
    return { density: 'comfortable', regions: r, asks: asks('release-diff', 'contributors', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
