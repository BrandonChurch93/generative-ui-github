import { describe, expect, it } from 'vitest'
import { MODELS } from '@genui-github/core'
import type { CallUsage, ModelClient } from './anthropic'
import { nextContext } from './bind/testing'
import { fill, unvalidatedFigures } from './fill'
import { TEMPLATES } from './templates/registry'

const usage: CallUsage = { model: MODELS.haiku, inputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 }
const answering = (slots: Record<string, string>): ModelClient => ({
  // The stand-in answers for whichever schema fill passed; fill only ever passes its own.
  json: async () => ({ value: { slots: Object.entries(slots).map(([id, text]) => ({ id, text })) } as never, usage, stopReason: 'end_turn' }),
  stream: () => {
    throw new Error('fill never streams')
  },
})

async function releaseBlockers() {
  const ctx = await nextContext()
  return { ctx, screen: TEMPLATES['release-blockers']!.compose(ctx, {}) }
}

describe('fill', () => {
  it('keeps a rewrite whose figures are all in the data', async () => {
    const { ctx, screen } = await releaseBlockers()
    const { screen: filled, kept, refused } = await fill(answering({ 'insight:answer#sentence': '1,620 pull requests are waiting on a first review, and 57 of 421 checks fail on `canary`.' }), ctx, screen, "What's blocking the next release?")
    expect(refused).toEqual([])
    expect(kept).toEqual(['insight:answer#sentence'])
    expect((filled.regions.insight[0]!.props as { sentence: string }).sentence).toContain('1,620 pull requests')
    expect(unvalidatedFigures(filled, ctx)).toEqual([])
  })

  it('refuses a figure the data does not hold, and one hidden in backticks, keeping the system sentence', async () => {
    const { ctx, screen } = await releaseBlockers()
    const before = (screen.regions.insight[0]!.props as { sentence: string }).sentence
    const chart = screen.regions.side[0]!
    const { screen: filled, refused } = await fill(
      answering({ 'insight:answer#sentence': '1,700 pull requests are waiting on review.', [`${chart.id}#finding`]: 'CI p50 hit `45` minutes last week.' }),
      ctx,
      screen,
      "What's blocking the next release?",
    )
    expect(refused.map(r => r.id)).toEqual(['insight:answer#sentence', `${chart.id}#finding`])
    expect(refused[0]!.problems[0]).toMatch(/figures not in the data: 1,700/)
    expect(refused[1]!.problems).toContain('`45` is not in the data')
    expect((filled.regions.insight[0]!.props as { sentence: string }).sentence).toBe(before)
    expect(unvalidatedFigures(filled, ctx)).toEqual([])
  })

  it('takes an empty delta as no delta, and leaves a screen with no answer from the model as it was', async () => {
    const { ctx, screen } = await releaseBlockers()
    const metric = screen.regions.metrics[0]!
    const { screen: filled } = await fill(answering({ [`${metric.id}#delta`]: '' }), ctx, screen, "What's blocking the next release?")
    expect(filled.regions.metrics[0]!.props).not.toHaveProperty('delta')
    const silent = await fill(answering({}), ctx, screen, 'x')
    expect(silent.screen).toEqual(screen)
  })

  it('closure ratio: the chart, the metric and the insight name one value in ×, and a percent for it is refused', async () => {
    const ctx = await nextContext()
    const screen = TEMPLATES.responsiveness!.compose(ctx, {})
    const metric = screen.regions.metrics.find(p => p.id === 'metric:closure-ratio')!.bound as { value: number; suffix: string; series: { points: number[] } }
    const chart = screen.regions.side.find(p => p.component === 'LineChart')!
    const bound = chart.bound as { unit: string; series: { points: (number | null)[] }[]; finding: string }
    expect(metric.suffix).toBe('×')
    expect(bound.unit).toBe('ratio')
    expect(bound.series[0]!.points).toEqual(metric.series.points)
    expect(bound.finding).toMatch(/^Closure ratio went from \d\.\d× to \d\.\d× over 12 weeks\.$/)

    const [first, last] = [metric.series.points[0]!, metric.series.points.at(-1)!]
    const pct = (v: number) => `${Math.round(v * 100)}%`
    const { kept, refused } = await fill(
      answering({
        [`${chart.id}#finding`]: `Closure ratio fell from ${pct(first)} to ${pct(last)} over 12 weeks.`,
        'insight:answer#sentence': `Maintainers close ${pct(metric.value)} of what opens.`,
      }),
      ctx,
      screen,
      'How responsive are the maintainers?',
    )
    expect(kept).toEqual([])
    expect(refused.map(r => r.id).sort()).toEqual([`${chart.id}#finding`, 'insight:answer#sentence'].sort())
    const times = await fill(answering({ [`${chart.id}#finding`]: `Closure ratio slipped from ${first}× to ${last}× over 12 weeks.` }), ctx, screen, 'How responsive are the maintainers?')
    expect(times.kept).toEqual([`${chart.id}#finding`])
  })
})
