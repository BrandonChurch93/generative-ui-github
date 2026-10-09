import { asks, bind, heatmap, insight, lineChart, metric, slotsFor, value } from '../build'
import { pieces, regions, type Template } from '../template'

export const contributors: Template = {
  id: 'contributors',
  density: 'comfortable',
  compose(ctx) {
    const bus = value(ctx, 'bus-factor')
    const risk = bus !== null && bus <= 2
    const r = regions({
      insight: [insight(ctx, ['bus-factor', 'contributors', 'core-share'], risk ? 'warn' : undefined)],
      metrics: pieces(metric(ctx, 'contributors'), metric(ctx, 'bus-factor', { hot: risk }), metric(ctx, 'core-share')),
      main: [bind(ctx, 'ContributorRank', { title: 'Merged commits by author', meta: 'last 90 days', measure: 'commits', limit: 8, wallTone: risk ? 'risk' : 'fact' })],
      side: [
        lineChart(ctx, { title: 'Core and community', meta: 'share of merged pull requests', series: [{ measure: 'core-share', name: 'Core' }, { measure: 'community-share', name: 'Community' }], window: '12w' }),
        heatmap(ctx, { title: 'When commits land', unit: 'commits', window: '12w' }),
      ],
    })
    return { density: 'comfortable', regions: r, asks: asks('responsiveness', 'punch-card', 'new-contributor', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
