import { describe, expect, it } from 'vitest'
import { EXIT_LEAD, leave, plan, REGION_STAGGER } from './choreography'
import { diff } from './diff'
import { FIXTURES } from './fixtures'
import { toScreen } from './screen'

const [one, two] = [FIXTURES.releaseBlockers, FIXTURES.checkFailures].map(c => toScreen(c))

describe('choreography of a follow-up', () => {
  it('leaves every piece but the clicked one on the rewrite beat', () => {
    const p = leave(diff(one, { ...one!, id: 'awaiting', regions: { insight: [], metrics: [], main: [], side: [], action: [] } }), { anchor: 'metric:failing-checks', token: 1 })
    expect(p.cues.get('metric:failing-checks')).toEqual({ action: 'keep', at: 0 })
    expect(p.cues.get('insight:answer')).toEqual({ action: 'leave', at: 0 })
    expect(p.cues.get('metric:open-prs')).toEqual({ action: 'leave', at: REGION_STAGGER })
  })

  it('keeps the clock the click started: in time, entrances land on their beat; late, they enter at once', () => {
    const d = diff(one, two!)
    const early = plan(d, { since: 0.1 })
    expect(early.carry).toBe(true)
    expect(early.cues.get('metric:failing-checks')!.at).toBeCloseTo(plan(d).cues.get('metric:failing-checks')!.at - 0.1, 5)
    const entered = d.enter[0]!
    expect(early.cues.get(entered.id)!.at).toBeCloseTo(plan(d).cues.get(entered.id)!.at - 0.1, 5)
    const late = plan(d, { since: 5 })
    expect(late.cues.get(entered.id)!.at).toBeCloseTo(plan(d).cues.get(entered.id)!.at - EXIT_LEAD, 5)
    expect([...late.cues.values()].every(c => c.at >= 0)).toBe(true)
  })
})
