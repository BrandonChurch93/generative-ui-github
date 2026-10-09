import { action, asks, bind, insight, inWords, lineChart, metric, slotsFor, value } from '../build'
import { pieces, regions, type Template } from '../template'

export const checkFailures: Template = {
  id: 'check-failures',
  density: 'comfortable',
  compose(ctx, params) {
    const branch = params.branch ?? ctx.repo.defaultBranch
    const failing = (ctx.shapes.checks?.runs ?? []).filter(r => r.conclusion === 'failure' || r.conclusion === 'timed_out').map(r => r.name)
    // An action names what it acts on, at most 64 characters each; a long matrix job name is left to the list.
    const targets = [...new Set(failing)].filter(name => name.length <= 64).slice(0, 3)
    const r = regions({
      insight: [insight(ctx, ['failing-checks', 'failing-since', 'flaky-rate'], failing.length ? 'crit' : undefined)],
      metrics: pieces(
        metric(ctx, 'failing-checks', { hot: (value(ctx, 'failing-checks') ?? 0) > 0 }),
        metric(ctx, 'failing-since', { hot: (value(ctx, 'failing-since') ?? 0) > 0 }),
        metric(ctx, 'ci-p50'),
        metric(ctx, 'flaky-rate'),
      ),
      main: [bind(ctx, 'StatusList', { kind: 'check', title: `Checks on ${branch}`.slice(0, 48), meta: 'latest run', scope: { branch }, sort: 'duration', limit: 5 })],
      side: [lineChart(ctx, { title: 'CI duration', meta: 'p50 · last 12 weeks', series: [{ measure: 'ci-p50', name: 'p50' }], failures: true, window: '12w' }, { emphasis: 'high' })],
      action: targets.length
        ? [
            action(ctx, {
              heading: `Re-run the ${inWords(targets.length)} failing ${targets.length === 1 ? 'check' : 'checks'}`,
              body: `Re-runs the failed jobs on ${branch}, which tells a flaky failure from a real one. Nothing merges.`.slice(0, 140),
              primary: 'Re-run checks',
              effect: { kind: 'rerun-checks', targets },
            }),
          ]
        : [],
    })
    return { density: 'comfortable', regions: r, asks: asks('ci-trend', 'release-blockers'), slots: slotsFor(Object.values(r).flat()) }
  },
}
