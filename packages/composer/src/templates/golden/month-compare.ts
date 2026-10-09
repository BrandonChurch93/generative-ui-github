import { asks, bind, comparison, insight, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const monthCompare: Template = {
  id: 'month-compare',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['prs-merged', 'failing-check-rate', 'review-wait-median'])],
      metrics: pieces(metric(ctx, 'prs-merged', { trend: true }), metric(ctx, 'failing-check-rate', { trend: true })),
      main: [
        comparison(ctx, {
          title: 'This month against last',
          window: 'month',
          pairs: [
            { measure: 'prs-merged', direction: 'higher-is-better' },
            { measure: 'failing-check-rate', direction: 'lower-is-better' },
            { measure: 'review-wait-median', direction: 'lower-is-better' },
            { measure: 'time-to-close-median', direction: 'lower-is-better' },
          ],
        }),
      ],
      side: [bind(ctx, 'StatusList', { kind: 'workflow', title: 'CI workflows', meta: 'last 30 days', scope: { window: '30d' }, sort: 'duration', limit: 5 })],
    })
    return { density: 'comfortable', regions: r, asks: asks('ci-trend', 'merged-recent', 'responsiveness'), slots: slotsFor(Object.values(r).flat()) }
  },
}
