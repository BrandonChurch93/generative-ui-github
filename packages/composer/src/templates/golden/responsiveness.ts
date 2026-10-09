import { asks, bind, insight, lineChart, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const responsiveness: Template = {
  id: 'responsiveness',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['review-wait-median', 'closure-ratio', 'time-to-close-median'])],
      metrics: pieces(metric(ctx, 'review-wait-median'), metric(ctx, 'closure-ratio', { trend: true }), metric(ctx, 'time-to-close-median')),
      main: [bind(ctx, 'ContributorRank', { title: 'Reviews by reviewer', meta: 'last 90 days', measure: 'reviews', limit: 8, wallTone: 'fact' })],
      side: [
        bind(ctx, 'Distribution', { title: 'Time to first review', measure: 'firstReview', population: 'all', perspective: 'neutral' }),
        lineChart(ctx, { title: 'Closure ratio', meta: 'closed per opened · weekly', series: [{ measure: 'closure-ratio', name: 'Closure ratio' }], window: '12w' }),
      ],
    })
    return { density: 'comfortable', regions: r, asks: asks('stale-issues', 'contributors', 'month-compare'), slots: slotsFor(Object.values(r).flat()) }
  },
}
