import { MEASURES, type MeasureId } from '@genui-github/data'
import { extractNumbers } from '@genui-github/ui/schemas'
import { bound, type Binder } from './types'
import { inline, measureNumbers } from './group-a-shared'
import type { CalloutModelProps, CalloutProps } from './group-a-ui'

// Callout: the model's one sentence and its tone. It names no sources, so the figures it may cite are the
// measures this answer computed; the meta line names the ones the sentence's figures came from.

export const bindCallout: Binder<CalloutModelProps> = (ctx, props, extras = {}) => {
  const measures = Object.values(ctx.measures).filter(m => m !== null && m !== undefined)
  const figures = extractNumbers(props.text)
  const numbers = measures.flatMap(m => measureNumbers(m, ctx.now))
  const cited = measures.filter(m => {
    const own = measureNumbers(m, ctx.now)
    return figures.some(f => own.some(v => Math.round(Math.abs(v) * 10 ** f.decimals) / 10 ** f.decimals === f.value))
  })
  const names = [...new Set(cited.map(m => inline(MEASURES[m.id as MeasureId].label)))].slice(0, 2)
  const boundProps: CalloutProps = { tone: props.tone, text: props.text, numbers, ...(names.length ? { meta: `from ${names.join(' · ')}` } : {}) }
  return bound('Callout', props, boundProps, extras)
}
