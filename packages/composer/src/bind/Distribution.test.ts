// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw, without } from './group-b-testing'
import { bindDistribution } from './Distribution'

afterEach(cleanup)

const props = { title: 'Time to first review', meta: 'last 90 days', measure: 'firstReview' as const, population: 'firstTime' as const }

describe('bindDistribution', () => {
  it('bins first-review waits for first-time contributors and says where the capped list starts', async () => {
    const { node, warnings } = check(bindDistribution(await nextContext(), props))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(node.props).toMatchObject({ meta: 'since Oct 1', perspective: 'reader', counts: [10, 4, 3, 3, 1, 2, 0] })
    const { medianMinutes, p90Minutes } = node.props as { medianMinutes: number; p90Minutes: number }
    expect(Math.round(medianMinutes)).toBe(95)
    expect(p90Minutes).toBeGreaterThan(medianMinutes)
    const { getByRole } = draw(node)
    expect(getByRole('group', { name: /^Half of first-time contributors got a first review within 2 hours\./ })).toBeTruthy()
  })

  it('is an error naming what failed when pull requests were not fetched', async () => {
    const { node } = check(bindDistribution(without(await nextContext(), 'pulls'), props))
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't load review times", cause: "Not in this answer's data" })
  })
})
