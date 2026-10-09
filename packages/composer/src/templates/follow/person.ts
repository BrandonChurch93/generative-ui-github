import { asks, bind, insight, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const person: Template = {
  id: 'person',
  density: 'comfortable',
  compose(ctx, params) {
    const handle = params.handle ?? ctx.scope?.author
    const scope = handle ? { author: handle } : undefined
    const r = regions({
      insight: [insight(ctx, ['prs-merged', 'commits', 'open-prs'])],
      metrics: pieces(metric(ctx, 'prs-merged'), metric(ctx, 'commits', { window: '30d' }), metric(ctx, 'open-prs')),
      main: [bind(ctx, 'Timeline', { title: handle ? `Merged by ${handle}`.slice(0, 48) : 'Merged recently', kind: 'merged', ...(scope ? { scope } : {}), limit: 8 })],
      side: [bind(ctx, 'StatusList', { kind: 'pull', title: handle ? `Open from ${handle}`.slice(0, 48) : 'Open pull requests', ...(scope ? { scope } : {}), sort: 'age', limit: 5 })],
    })
    return { density: 'comfortable', regions: r, asks: asks('contributors', 'merged-recent'), slots: slotsFor(Object.values(r).flat()) }
  },
}
