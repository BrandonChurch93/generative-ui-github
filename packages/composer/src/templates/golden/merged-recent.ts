import { asks, bind, insight, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const mergedRecent: Template = {
  id: 'merged-recent',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['prs-merged', 'contributors'])],
      metrics: pieces(metric(ctx, 'prs-merged', { trend: true }), metric(ctx, 'contributors', { window: '7d' })),
      main: [bind(ctx, 'Timeline', { title: 'Merged this week', meta: 'last 7 days', kind: 'merged', scope: { window: '7d' }, limit: 8, dayAsk: 'What merged on {day}?' })],
      side: [bind(ctx, 'PersonList', { measure: 'commits', limit: 5 })],
    })
    return { density: 'comfortable', regions: r, asks: asks('release-diff', 'contributors', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
