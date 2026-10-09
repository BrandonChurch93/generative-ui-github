import { asks, bind, insight, metric, repoName, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const releaseDiff: Template = {
  id: 'release-diff',
  density: 'comfortable',
  compose(ctx) {
    const between = ctx.shapes.commitsBetweenTags
    const scope = between ? { base: between.base, head: between.head } : undefined
    const r = regions({
      insight: [insight(ctx, ['commits', 'contributors', 'files-changed'])],
      metrics: pieces(metric(ctx, 'commits'), metric(ctx, 'contributors'), metric(ctx, 'files-changed')),
      main: [bind(ctx, 'Timeline', { title: between ? `${between.base} to ${between.head}`.slice(0, 48) : 'Between the last two releases', kind: 'commits', ...(scope ? { scope } : {}), limit: 8 })],
      side: pieces(between && bind(ctx, 'FileTree', { repo: repoName(ctx), mode: 'overview', title: 'Changed files' })),
    })
    return { density: 'comfortable', regions: r, asks: asks('merged-recent', 'contributors', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
