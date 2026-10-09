// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { validateNumbers } from '@genui-github/ui/schemas'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { seriesFacts } from './group-a-shared'
import { bindMetric } from './Metric'
import type { MetricProps } from './group-a-ui'

afterEach(cleanup)

describe('bindMetric', () => {
  it('binds the CI median with its trend, and a delta citing the series passes', async () => {
    const ctx = await nextContext()
    const piece = bindMetric(ctx, { measure: 'ci-p50', trend: true, delta: 'up from 7.3 min', hot: true })
    const { node, warnings } = check(piece, 'metrics')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(node.id).toBe('metric:ci-p50')
    const props = node.props as MetricProps
    expect(props).toMatchObject({ label: 'Median CI run', value: 11.3, suffix: 'min', format: 'count', delta: 'up from 7.3 min', windowWords: 'build-and-test · last 7 days' })
    expect(props.series?.points).toHaveLength(12)
    expect(props.series?.finding).toBe('Up from 7.3 to 12.3 min over 12 weeks')
    expect(validateNumbers(props.series!.finding, seriesFacts(props.series!.points)).ok).toBe(true)
    expect(draw(node).container.textContent).toContain('11.3')
  })

  it('says where a listed measure starts, and drops a delta the data cannot back', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindMetric(ctx, { measure: 'review-wait-median', delta: '9 hours faster' }), 'metrics')
    expect(node.props).toMatchObject({ value: 1.1, suffix: 'h', windowWords: 'since Sep 30' })
    expect((node.props as MetricProps).delta).toBeUndefined()
    expect(warnings).toHaveLength(1)
    expect(check(bindMetric(ctx, { measure: 'failing-checks' })).node.props).toMatchObject({ value: 57, suffix: 'of 421', windowWords: 'canary head' })
  })

  it('is empty with the reason when next.js has no dated milestone, and unavailable when checks were not read', async () => {
    const ctx = await nextContext()
    const { node } = check(bindMetric(ctx, { measure: 'milestone-closes' }), 'metrics')
    expect(node.state).toBe('empty')
    expect(node.props).toMatchObject({ message: 'No release milestone with a due date', label: 'Milestone due' })
    draw(node)

    const { checks: _checks, ...shapes } = ctx.shapes
    const missing = check(bindMetric({ ...ctx, shapes }, { measure: 'failing-checks' }), 'metrics').node
    expect(missing.state).toBe('error')
    expect(missing.error).toEqual({ failed: "Couldn't load", cause: "Not in this answer's data" })
    expect(draw(missing).container.textContent).toContain('Failing checks')
  })
})
