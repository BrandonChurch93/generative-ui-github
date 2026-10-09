import { systemDiffPath } from '../../bind/DiffView'
import { asks, bind, insight, metric, repoName, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const biggestPr: Template = {
  id: 'biggest-pr',
  density: 'comfortable',
  compose(ctx) {
    const pull = ctx.shapes.biggestOpenPr?.pull
    const repo = repoName(ctx)
    const path = pull ? systemDiffPath(ctx, pull.number) : undefined
    const r = regions({
      insight: [insight(ctx, ['pr-size', 'files-changed', 'review-wait-median'])],
      metrics: pieces(metric(ctx, 'pr-size'), metric(ctx, 'files-changed'), metric(ctx, 'review-wait-median')),
      main: pieces(
        pull && path && bind(ctx, 'DiffView', { repo, pr: pull.number, path }),
        bind(ctx, 'StatusList', { kind: 'check', title: 'Checks on the default branch', meta: 'latest run', scope: { branch: ctx.repo.defaultBranch }, sort: 'duration', limit: 5 }),
      ),
      side: pieces(pull && bind(ctx, 'FileTree', { repo, mode: 'changes', pr: pull.number, title: `Files in #${pull.number}`, ...(path ? { selected: path } : {}) })),
    })
    return { density: 'comfortable', regions: r, asks: asks('release-blockers', 'responsiveness', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
