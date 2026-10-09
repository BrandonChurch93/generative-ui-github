// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { NUMBER_MISMATCH_SENTENCE } from '@genui-github/ui/schemas'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindInsight, systemInsight } from './Insight'
import type { InsightProps } from './group-a-ui'

afterEach(cleanup)

describe('bindInsight', () => {
  it('writes a default sentence from measures that passes its own number check', async () => {
    const ctx = await nextContext()
    const props = systemInsight(ctx, ['open-prs', 'failing-checks', 'ci-p50', 'busiest-hour'])
    expect(props.sentence).toBe('2,524 open pull requests, 57 of 421 failing checks, median CI run 11.3 min and busiest hour 16:00.')
    const { node, warnings } = check(bindInsight(ctx, props), 'insight')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(draw(node).container.textContent).toContain('from 2,524 open pull requests')
  })

  it('lets a sentence cite a shape and its measure, and says where a listed measure starts', async () => {
    const ctx = await nextContext()
    const piece = bindInsight(ctx, {
      sentence: '57 of 421 checks fail on `canary`, and the median first response took 1.1 hours.',
      sources: [{ key: 'checks' }, { key: 'review-wait-median', ask: 'How long do reviews take?' }],
      tone: 'warn',
    })
    const { node, warnings } = check(piece, 'insight')
    expect(warnings).toEqual([])
    const props = node.props as InsightProps
    expect(props.sourceMap?.checks?.words).toBe('421 check runs on canary')
    expect(props.facts).toEqual(['since Sep 30'])
  })

  it('replaces a sentence whose figure is not in the data, and a key the context lacks cites nothing', async () => {
    const ctx = await nextContext()
    const wrong = check(bindInsight(ctx, { sentence: 'There are 99 failing checks.', sources: [{ key: 'failing-checks' }] }), 'insight')
    expect((wrong.node.props as InsightProps).sentence).toBe(NUMBER_MISMATCH_SENTENCE)
    const absent = check(bindInsight(ctx, { sentence: 'Traffic rose 40% this week.', sources: [{ key: 'traffic' }] }), 'insight')
    expect((absent.node.props as InsightProps).sourceMap?.traffic).toEqual({ words: 'traffic', numbers: [] })
    expect((absent.node.props as InsightProps).sentence).toBe(NUMBER_MISMATCH_SENTENCE)
  })
})
