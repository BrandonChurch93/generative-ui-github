import { asks, bind, comparison, insight, lineChart, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const ciTrend: Template = {
  id: 'ci-trend',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['ci-p50', 'failing-check-rate', 'slowest-job'])],
      metrics: pieces(metric(ctx, 'ci-p50', { trend: true }), metric(ctx, 'failing-check-rate', { trend: true }), metric(ctx, 'slowest-job')),
      main: [bind(ctx, 'StatusList', { kind: 'workflow', title: 'CI workflows', meta: 'default branch · last 30 days', scope: { window: '30d' }, sort: 'duration', limit: 5 })],
      side: [
        lineChart(ctx, { title: 'CI duration', meta: 'p50 · last 12 weeks', series: [{ measure: 'ci-p50', name: 'p50' }], failures: true, window: '12w' }),
        comparison(ctx, {
          title: 'This month against last',
          window: 'month',
          pairs: [
            { measure: 'ci-p50', direction: 'lower-is-better' },
            { measure: 'failing-check-rate', direction: 'lower-is-better' },
            { measure: 'flaky-rate', direction: 'lower-is-better' },
          ],
        }),
      ],
    })
    return { density: 'comfortable', regions: r, asks: asks('release-blockers', 'month-compare', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
