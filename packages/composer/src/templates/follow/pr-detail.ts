import { systemDiffPath } from '../../bind/DiffView'
import { action, asks, bind, insight, metric, repoName, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const prDetail: Template = {
  id: 'pr-detail',
  density: 'comfortable',
  compose(ctx, params) {
    const pr = params.pr ?? ctx.scope?.pr ?? ctx.shapes.biggestOpenPr?.pull?.number
    const repo = repoName(ctx)
    const pull = [...(ctx.shapes.pulls?.open ?? []), ...(ctx.shapes.pulls?.merged ?? [])].find(p => p.number === pr)
    const path = pr ? systemDiffPath(ctx, pr) : undefined
    const waiting = pull && !pull.mergedAt && !pull.draft && pull.firstHumanReviewAt === null
    const r = regions({
      insight: [insight(ctx, ['pr-size', 'files-changed', 'review-wait-median'])],
      metrics: pieces(metric(ctx, 'pr-size', pr ? { scope: String(pr) } : {}), metric(ctx, 'files-changed', pr ? { scope: String(pr) } : {}), metric(ctx, 'review-wait-median')),
      main: pieces(pr && path ? bind(ctx, 'DiffView', { repo, pr, path }) : null, pr ? bind(ctx, 'KeyValue', { source: 'pr', scope: { pr } }) : null),
      side: pieces(pr ? bind(ctx, 'FileTree', { repo, mode: 'changes', pr, title: `Files in #${pr}`, ...(path ? { selected: path } : {}) }) : null),
      action: waiting
        ? [
            action(ctx, {
              heading: `Ask for a review on #${pr}`,
              body: 'Requests a review from a maintainer who knows these files. Nothing merges.',
              primary: 'Request a review',
              effect: { kind: 'request-review', targets: [`#${pr}`] },
            }),
          ]
        : [],
    })
    return { density: 'comfortable', regions: r, asks: asks('release-blockers', 'biggest-pr', 'responsiveness'), slots: slotsFor(Object.values(r).flat()) }
  },
}
