import { describe, expect, it } from 'vitest'
import { FIXTURES } from './fixtures'
import { toStream } from './format'
import { diff } from './diff'
import { toScreen } from './screen'
import { createStreamParser } from './stream'

const [one, two, three] = [FIXTURES.releaseBlockers, FIXTURES.checkFailures, FIXTURES.contributors].map(c => toScreen(c))
const ids = (list: { id: string }[]) => list.map(e => e.id)

describe('diff engine', () => {
  it('enters everything on the first screen', () => {
    const d = diff(undefined, one!)
    expect(d.mode).toBe('initial')
    expect(d.enter).toHaveLength(8)
    expect([d.exit, d.morph, d.keep].flat()).toEqual([])
  })

  it('keeps a piece whose props did not change', () => {
    expect(ids(diff(one, toScreen(FIXTURES.releaseBlockers)).keep)).toHaveLength(8)
  })

  it('1 to 2 morphs failing checks and the CI chart, exits the other three metrics, enters three', () => {
    const d = diff(one, two!)
    expect(d.mode).toBe('rewrite')
    expect(ids(d.morph)).toEqual(['insight:answer', 'metric:failing-checks', 'linechart:ci-p50'])
    expect(ids(d.exit)).toEqual([
      'metric:open-prs',
      'metric:awaiting-review',
      'metric:milestone-issues-open',
      'statuslist:pull:milestone-v16.2',
      'actioncard:request-review:#84120+#84156+#84201',
    ])
    expect(ids(d.enter)).toEqual([
      'metric:failing-since',
      'metric:ci-p50',
      'metric:flaky-rate',
      'statuslist:check:branch-canary',
      'actioncard:rerun-checks:e2e-turbopack+test-unit (windows)',
    ])
    expect(d.morph[1]).toMatchObject({ prev: { props: { value: 1 } }, node: { props: { value: 2 } } })
    expect(d.keep).toEqual([])
  })

  it('2 to 3 enters the ContributorRank and exits the StatusList', () => {
    const d = diff(two, three!)
    expect(ids(d.enter)).toContain('rank:commits:90d')
    expect(ids(d.exit)).toContain('statuslist:check:branch-canary')
    expect(ids(d.morph)).toEqual(['insight:answer'])
  })

  it('3 to 1 morphs awaiting review, which moved from the fourth slot to the second', () => {
    const d = diff(three, one!)
    const awaiting = d.morph.find(e => e.id === 'metric:awaiting-review')
    expect(awaiting).toMatchObject({ index: 1, prev: { ask: "What's blocking the next release?" } })
    expect(awaiting?.node.ask).toBeUndefined()
  })

  it('an update op under the same composition reports no exit and no enter', () => {
    const parser = createStreamParser()
    for (const op of toStream(FIXTURES.releaseBlockers)) parser.push(`${JSON.stringify(op)}\n`)
    const before = toScreen(parser.tree())
    const bound = FIXTURES.releaseBlockers.regions.metrics[0]!.bound as object
    const after = toScreen(parser.push(`${JSON.stringify({ op: 'update', id: 'metric:open-prs', props: { ...bound, value: 8 } })}\n`))
    const d = diff(before, after)
    expect(d.mode).toBe('update')
    expect([d.exit, d.enter]).toEqual([[], []])
    expect(ids(d.morph)).toEqual(['metric:open-prs'])
    expect(d.keep).toHaveLength(7)
  })
})
