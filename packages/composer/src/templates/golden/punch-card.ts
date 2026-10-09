import { asks, bind, heatmap, insight, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const punchCard: Template = {
  id: 'punch-card',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['busiest-hour', 'quietest-day', 'commits'])],
      metrics: pieces(metric(ctx, 'busiest-hour'), metric(ctx, 'quietest-day')),
      main: [heatmap(ctx, { title: 'When commits land', unit: 'commits', window: '12w', cellAsk: 'What landed on {weekday}s around {hour}?' })],
      side: [bind(ctx, 'PersonList', { measure: 'commits', limit: 5 })],
    })
    return { density: 'comfortable', regions: r, asks: asks('contributors', 'merged-recent', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
