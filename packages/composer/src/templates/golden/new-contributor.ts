import { systemSteps } from '../../bind/Steps'
import { asks, bind, insight, slotsFor } from '../build'
import { regions, type Template } from '../template'

export const newContributor: Template = {
  id: 'new-contributor',
  density: 'comfortable',
  compose(ctx) {
    const r = regions({
      insight: [insight(ctx, ['good-first-issues', 'review-wait-median', 'first-time-contributors'])],
      main: [bind(ctx, 'Steps', systemSteps(ctx))],
      side: [
        bind(ctx, 'Distribution', { title: 'Time to first review', meta: 'first-time contributors', measure: 'firstReview', population: 'firstTime', perspective: 'reader' }),
        bind(ctx, 'Checklist', { title: 'Community standards', source: 'community-standards' }),
      ],
    })
    return { density: 'comfortable', regions: r, asks: asks('stale-issues', 'responsiveness', 'overview'), slots: slotsFor(Object.values(r).flat()) }
  },
}
