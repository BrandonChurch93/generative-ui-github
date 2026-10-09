// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-b-testing'
import { bindBarChart, systemFinding } from './BarChart'

afterEach(cleanup)

const stale = { title: 'Stale issues by label', measure: 'stale-issues' as const, by: 'label' as const, finding: 'x' }

describe('bindBarChart', () => {
  it('counts the listed stale issues by label, largest first, and says the list is a sample', async () => {
    const ctx = await nextContext()
    const finding = systemFinding(ctx, stale)
    expect(finding).toBe('bug leads with 45 stale issues, ahead of Linking and Navigating at 6.')
    const { node, warnings } = check(bindBarChart(ctx, { ...stale, finding }))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as { bars: { key: string; value: number }[]; meta: string; unit: string }
    expect(props.bars).toHaveLength(12)
    expect(props.bars[0]).toEqual({ key: 'bug', label: 'bug', value: 45 })
    expect(props.meta).toBe('50 listed of 901')
    expect(props.unit).toBe('count')
    const { container } = draw(node)
    expect(container.querySelector(`[aria-label="${finding}"]`)).not.toBeNull()
  })

  it('reads CI runs by workflow over the measure window', async () => {
    const { node } = check(bindBarChart(await nextContext(), { title: 'Failing runs', measure: 'failing-check-rate', by: 'workflow', finding: 'x' }))
    expect(node.props).toMatchObject({ unit: 'percent', meta: 'last 30 days', bars: [{ key: 'build-and-test', value: 23.3 }] })
  })

  it('cannot group by area, which no list here carries', async () => {
    const { node } = check(bindBarChart(await nextContext(), { title: 'Commits by area', measure: 'commits', by: 'area', finding: 'x' }))
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't group commits by area", cause: 'The data has no area for it' })
  })
})
