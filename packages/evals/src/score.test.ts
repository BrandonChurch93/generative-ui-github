import { describe, expect, it } from 'vitest'
import type { Composition, Piece } from '@genui-github/renderer/core'
import { at, f1, rendererFindings, scoreBindings, scoreComponents, scoreHot, scoreTemplate } from './score'

const built: Composition['built'] = { template: 'release-blockers', model: 'claude-haiku-5-5', tokens: { input: 0, cached: 0, output: 0 }, costUsd: 0, latencyMs: { classify: 0, data: 0, compose: 0, total: 0 }, githubReads: 0, chose: [] }

const metric = (measure: string, value: number, hot = false): Piece => ({
  id: `metric:${measure}`,
  component: 'Metric',
  props: { measure, ...(hot ? { hot: true } : {}) },
  bound: { measure, label: measure, value, format: 'count', ...(hot ? { hot: true } : {}) },
})

function composition(metrics: Piece[], extra: Partial<Composition['regions']> = {}): Composition {
  return { id: 'cmp-test', density: 'comfortable', asks: [], built, regions: { insight: [], metrics, main: [], side: [], action: [], ...extra } }
}

describe('scorers', () => {
  it('template is an exact match and says where it went instead', () => {
    expect(scoreTemplate('ci-trend', 'ci-trend')).toEqual({ pass: true })
    expect(scoreTemplate('ci-trend', 'overview')).toEqual({ pass: false, reason: 'routed to overview, expected ci-trend' })
  })

  it('components is F1 over the multiset, passing at 0.85, and names what is missing and extra', () => {
    expect(f1(['Metric', 'Metric', 'StatusList'], ['Metric', 'StatusList', 'Metric'])).toBe(1)
    expect(f1(['Metric', 'Metric'], ['Metric'])).toBeCloseTo(2 / 3)
    expect(f1(['Metric'], ['LineChart'])).toBe(0)
    const four = ['Metric', 'Metric', 'Metric', 'Metric', 'StatusList', 'LineChart', 'ActionCard', 'Insight']
    const short = composition([metric('a', 1), metric('b', 2), metric('c', 3)], { insight: [{ id: 'i', component: 'Insight', props: {} }], main: [{ id: 's', component: 'StatusList', props: {} }], side: [{ id: 'l', component: 'LineChart', props: {} }], action: [{ id: 'x', component: 'ActionCard', props: {} }] })
    expect(scoreComponents(four, short)).toMatchObject({ pass: true, value: 0.933 })
    expect(scoreComponents(['Heatmap', 'PersonList'], short)).toMatchObject({ pass: false, value: 0, reason: expect.stringContaining('missing Heatmap, PersonList') })
  })

  it('hot is the exact set of metrics marked hot', () => {
    const c = composition([metric('open-prs', 1), metric('failing-checks', 2, true)])
    expect(scoreHot(['metric:failing-checks'], c).pass).toBe(true)
    expect(scoreHot(['metric:failing-checks', 'metric:awaiting-review'], c)).toMatchObject({ pass: false })
    expect(scoreHot([], composition([metric('open-prs', 1)])).pass).toBe(true)
  })

  it('bindings read the context path and compare to one decimal; a piece left out fails', () => {
    const ctx = { measures: { 'open-prs': { value: 2525 }, 'review-wait-median': { value: 1.14 }, 'failing-checks': { value: { count: 57, total: 485 } } } }
    expect(at(ctx, 'measures.open-prs.value')).toBe(2525)
    const c = composition([metric('open-prs', 2525), metric('review-wait-median', 1.1)])
    const bindings = [
      { id: 'metric:open-prs', prop: 'value', equals: 'measures.open-prs.value' },
      { id: 'metric:review-wait-median', prop: 'value', equals: 'measures.review-wait-median.value' },
      { id: 'metric:failing-checks', prop: 'value', equals: 'measures.failing-checks.value' },
    ]
    const withCount = composition([metric('open-prs', 2525), metric('review-wait-median', 1.1), metric('failing-checks', 57)])
    expect(scoreBindings(bindings, withCount, ctx)).toEqual({ pass: true, value: 1 })
    expect(scoreBindings(bindings.slice(0, 2), c, ctx)).toEqual({ pass: true, value: 1 })
    expect(scoreBindings([{ id: 'metric:not-composed', prop: 'value', equals: 'measures.contributors.value' }], c, ctx)).toMatchObject({ pass: false, value: 0, reason: 'metric:not-composed is not on screen' })
    const wrong = composition([metric('open-prs', 2524)])
    expect(scoreBindings(bindings.slice(0, 1), wrong, ctx)).toMatchObject({ pass: false, value: 0, reason: 'metric:open-prs.value is 2524, measures.open-prs.value is 2525' })
  })

  it('the renderer findings sort schema failures, number mismatches and rule drops', () => {
    const c = composition([], {
      insight: [{ id: 'insight:answer', component: 'Insight', props: { sentence: 'Hello.', sources: [] } }],
      main: [{ id: 'x', component: 'NotAComponent', props: {} }],
    })
    const found = rendererFindings(c)
    expect(found.schema.some(s => s.includes('unknown component'))).toBe(true)
    expect(found.numbers).toEqual([])
  })
})
