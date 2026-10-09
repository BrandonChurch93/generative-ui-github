import { action, asks, barChart, bind, insight, inWords, metric, slotsFor } from '../build'
import { pieces, regions, type Template } from '../template'

export const staleIssues: Template = {
  id: 'stale-issues',
  density: 'comfortable',
  compose(ctx) {
    const list = bind(ctx, 'StatusList', { kind: 'issue', title: 'Gone quiet', meta: 'no activity in 30 days', scope: { window: '30d' }, sort: 'activity', limit: 6 })
    const targets = (ctx.shapes.staleIssues?.issues ?? []).slice(0, 3).map(i => `#${i.number}`)
    const r = regions({
      insight: [insight(ctx, ['stale-issues', 'time-to-close-median'])],
      metrics: pieces(metric(ctx, 'stale-issues'), metric(ctx, 'time-to-close-median')),
      main: [
        bind(ctx, 'FilterChips', {
          target: list.id,
          mode: 'single',
          options: [
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
          ],
          selected: ['30d'],
        }),
        list,
      ],
      side: [barChart(ctx, { title: 'Stale issues by label', meta: 'no activity in 30 days', measure: 'stale-issues', by: 'label' })],
      action: targets.length
        ? [
            action(ctx, {
              heading: `Label the ${inWords(targets.length)} oldest`,
              body: 'Adds a stale label so they show up in triage. Nothing closes.',
              primary: 'Add labels',
              effect: { kind: 'add-label', targets },
            }),
          ]
        : [],
    })
    return { density: 'comfortable', regions: r, asks: asks('new-contributor', 'responsiveness', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
