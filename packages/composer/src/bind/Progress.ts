import { nextMilestone } from '@genui-github/data'
import { bound, empty, unavailable, type Binder } from './types'
import { absentCause, measureGaps, readMeasure, sha7, shape, shortDate } from './group-a-shared'
import { PROGRESS_EMPTY, type ProgressModelProps, type ProgressProps } from './group-a-ui'
import { emptyMessage } from './Metric'

// Progress: the model picks a count-of-total measure and labels it; the system reads the part and the whole.

export const bindProgress: Binder<ProgressModelProps> = (ctx, props, extras = {}) => {
  const frame: ProgressProps = { measure: props.measure, label: props.label, count: 0, total: 0 }
  let meta: string | undefined
  if (props.measure === 'failing-checks') {
    const checks = shape(ctx, 'checks')
    meta = `${ctx.repo.defaultBranch} head${checks ? ` · ${sha7(checks.ref)}` : ''}`
  } else {
    const milestones = shape(ctx, 'milestones')
    const m = ctx.scope?.milestone ? milestones?.open.find(x => x.title === ctx.scope!.milestone) : milestones && nextMilestone(milestones)
    if (m) meta = `milestone ${m.title}${m.dueOn ? ` · due ${shortDate(m.dueOn, ctx.timeZone)}` : ''}`
  }
  const withMeta = { ...frame, ...(meta ? { meta } : {}) }

  const result = readMeasure(ctx, props.measure)
  if (!result) {
    const gaps = measureGaps(ctx, props.measure)
    if (gaps.length) return unavailable('Progress', props, withMeta, { failed: "Couldn't load", cause: absentCause(ctx, gaps) }, extras)
    return empty('Progress', props, { ...withMeta, message: emptyMessage(ctx, props.measure, ctx.scope) }, extras)
  }
  const { count, total } = result.value as { count: number; total: number }
  const boundProps: ProgressProps = { ...withMeta, count, total }
  if (total <= 0) return empty('Progress', props, { ...boundProps, message: PROGRESS_EMPTY }, extras)
  return bound('Progress', props, boundProps, extras)
}
