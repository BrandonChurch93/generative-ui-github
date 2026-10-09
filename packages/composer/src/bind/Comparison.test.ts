// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-b-testing'
import { bindComparison, systemFinding } from './Comparison'

afterEach(cleanup)

const month = {
  title: 'This month against last',
  window: 'month' as const,
  pairs: [
    { measure: 'prs-merged' as const, direction: 'higher-is-better' as const },
    { measure: 'failing-check-rate' as const, direction: 'lower-is-better' as const, notable: true },
    { measure: 'review-wait-median' as const, direction: 'lower-is-better' as const },
    { measure: 'commits' as const, direction: 'neutral' as const },
  ],
  finding: 'x',
}

describe('bindComparison', () => {
  it('reads both months, leaves out the unknown review wait and names it in the source', async () => {
    const ctx = await nextContext()
    const finding = systemFinding(ctx, month)
    expect(finding).toBe('Pull requests merged fell from 462 to 156; failing run rate rose from 24.7% to 27.3%.')
    const { node, warnings } = check(bindComparison(ctx, { ...month, finding }))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as { pairs: { measure: string; current: number; previous: number }[]; source: string; periods: { current: string } }
    expect(props.pairs.map(p => [p.measure, p.current, p.previous])).toEqual([
      ['prs-merged', 156, 462],
      ['failing-check-rate', 27.3, 24.7],
      ['commits', 247, 581],
    ])
    expect(props.periods.current).toBe('October so far')
    expect(props.source).toBe('from 618 merged PRs · 223 runs of build-and-test · 828 commits · median review wait unknown for either window')
    const { container } = draw(node)
    expect(container.querySelector(`[aria-label="${finding}"]`)).not.toBeNull()
  })

  it('reads the exact weekly merge counts for a week against the last', async () => {
    const { node } = check(bindComparison(await nextContext(), { ...month, window: 'week' }))
    expect((node.props as { pairs: { current: number; previous: number }[] }).pairs[0]).toMatchObject({ current: 85, previous: 150 })
  })

  it('cannot compare milestones, which keep no past figures', async () => {
    const { node } = check(bindComparison(await nextContext(), { ...month, window: 'milestone' }))
    expect(node.state).toBe('error')
    expect(node.error?.failed).toBe("Couldn't compare milestones")
  })
})
