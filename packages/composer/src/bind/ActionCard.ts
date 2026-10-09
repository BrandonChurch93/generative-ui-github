import { ActionCard } from '@genui-github/ui/schemas'
import { bound, unavailable, type Binder, type DataContext } from './types'
import { shape } from './group-a-shared'
import type { ActionCardModelProps, ActionCardProps, Effect } from './group-a-ui'

// ActionCard: the model proposes one small step and names its targets; the system runs it in sample mode
// and refuses targets that are not what the effect acts on.

const REFERENCE = /^#(\d+)$/

/** Why a target is not something the effect can act on, or null when every target fits. */
export function targetProblem(ctx: DataContext, effect: Effect): string | null {
  for (const target of effect.targets) {
    if (effect.kind !== 'rerun-checks') {
      if (!REFERENCE.test(target)) return `${target} is not a pull request or issue number`
      if (effect.kind === 'request-review') {
        const n = Number(REFERENCE.exec(target)![1])
        const issues = shape(ctx, 'issues')
        if (issues && [...issues.open, ...issues.closed].some(i => i.number === n)) return `${target} is an issue, not a pull request`
      }
      continue
    }
    if (REFERENCE.test(target)) return `${target} is a pull request, not a check`
    const checks = shape(ctx, 'checks')?.runs.map(r => r.name) ?? []
    const workflows = shape(ctx, 'workflowRuns')?.runs.map(r => r.workflowName) ?? []
    if (!checks.includes(target) && !workflows.includes(target)) return `${target} is not a check in this answer's data`
  }
  return null
}

export const bindActionCard: Binder<ActionCardModelProps> = (ctx, props, extras = {}) => {
  const boundProps: ActionCardProps = { ...props, mode: 'sample' }
  const cites = props.effect.targets.flatMap(t => (REFERENCE.test(t) ? [Number(REFERENCE.exec(t)![1])] : []))
  const problem = targetProblem(ctx, props.effect)
  if (problem) return unavailable('ActionCard', props, boundProps, { failed: ActionCard.effectWords.failed(props.effect), cause: problem }, extras)
  return bound('ActionCard', props, boundProps, { ...extras, cites })
}
