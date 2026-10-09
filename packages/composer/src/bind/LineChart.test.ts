// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw, without } from './group-b-testing'
import { bindLineChart, systemFinding } from './LineChart'

afterEach(cleanup)

const ci = { title: 'CI duration', series: [{ measure: 'ci-p50' as const, name: 'Duration' }], failures: true, window: '12w' as const, finding: 'x' }

describe('bindLineChart', () => {
  it('binds twelve Monday weeks of CI p50 with the failure strip, and its system finding is the label', async () => {
    const ctx = await nextContext()
    const finding = systemFinding(ctx, ci)
    expect(finding).toBe('Median CI run went from 7.3 to 12.3 min over 12 weeks.')
    const { node, warnings } = check(bindLineChart(ctx, { ...ci, finding }))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(node.props).toMatchObject({
      unit: 'min',
      meta: 'p50 · last 12 weeks',
      weeks: expect.arrayContaining(['2026-07-20', '2026-10-05']),
      series: [{ name: 'Duration', points: [7.3, 10, 10.3, 21.5, 27.7, 14.9, 14.1, 19.4, 26.1, 14.4, 10.9, 12.3] }],
      failures: [5, 4, 15, 10, 5, 10, 14, 12, 5, 6, 10, 11],
    })
    const { container } = draw(node)
    expect(container.querySelector('[data-plot]')?.getAttribute('aria-label')).toBe(finding)
  })

  it('regroups commit stats into Monday weeks and leaves weeks the capped pull list misses null', async () => {
    const ctx = await nextContext()
    const commits = check(bindLineChart(ctx, { title: 'Commits', series: [{ measure: 'commits', name: 'Commits' }], window: '52w', finding: 'x' })).node
    const points = (commits.props as { series: { points: (number | null)[] }[] }).series[0]!.points
    expect(points).toHaveLength(52)
    expect(points.slice(-2)).toEqual([180, 128])

    const shares = check(
      bindLineChart(ctx, {
        title: 'Core and community',
        series: [
          { measure: 'core-share', name: 'Core' },
          { measure: 'community-share', name: 'Community' },
        ],
        finding: 'x',
      }),
    ).node
    const [core, community] = (shares.props as { series: { points: (number | null)[] }[] }).series
    expect(core!.points.slice(0, 11).every(p => p === null)).toBe(true)
    expect(core!.points[11]! + community!.points[11]!).toBe(100)
  })

  it('says what is missing when runs were not fetched or a measure has no weekly history', async () => {
    const ctx = without(await nextContext(), 'workflowRuns', 'ciDurationByWeek', 'failureRateByWeek')
    const { node } = check(bindLineChart(ctx, ci))
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't load median CI run", cause: "Not in this answer's data" })
    const stars = check(bindLineChart(ctx, { title: 'Stars', series: [{ measure: 'stars', name: 'Stars' }], finding: 'x' })).node
    expect(stars.error?.cause).toBe('GitHub keeps no weekly history for it')
  })
})
