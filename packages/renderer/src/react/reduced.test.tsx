import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { gsap } from 'gsap'
import { animate } from 'motion/react'
import { FIXTURES } from '../fixtures'
import { Renderer } from './Renderer'

vi.mock('motion/react', async original => {
  const real = await original<typeof import('motion/react')>()
  return { ...real, animate: vi.fn(real.animate) }
})

// Before anything renders: Motion reads the media query once and keeps the answer.
vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })

describe('reduced motion', () => {
  it('collapses every move in the entrance and a rewrite to an opacity change of 200ms or less', async () => {
    const created: gsap.core.Tween[] = []
    const to = vi.spyOn(gsap.core.Timeline.prototype, 'fromTo')
    const { rerender } = render(<Renderer composition={FIXTURES.releaseBlockers} question="What's blocking the next release?" />)
    rerender(<Renderer composition={FIXTURES.checkFailures} question="Which checks are failing on canary?" />)
    for (const tl of gsap.globalTimeline.getChildren(true, true, false)) created.push(tl as gsap.core.Tween)

    expect(created.length).toBeGreaterThan(20)
    // A staggered tween's total includes the offsets, which reduced motion keeps; each target's own move is `vars.duration`.
    const long = created.filter(t => (typeof t.vars.duration === 'number' ? t.vars.duration : t.duration()) > 0.2)
    expect(long.map(t => (t.targets()[0] as Element | undefined)?.outerHTML?.slice(0, 80))).toEqual([])
    // Nothing travels, scales, clips or counts: every move left is an opacity change.
    const MOVING = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'clipPath', 'strokeDashoffset', 'strokeDasharray', 'width', 'height', 'value']
    expect(to.mock.calls.length).toBeGreaterThan(20)
    for (const [, , vars] of to.mock.calls as unknown as [unknown, unknown, gsap.TweenVars][]) {
      expect(Object.keys(vars).filter(k => MOVING.includes(k))).toEqual([])
    }
    const motions = vi.mocked(animate).mock.calls as unknown as [Element, Record<string, unknown>, { duration: number }][]
    expect(motions.length).toBeGreaterThan(0)
    for (const [, keyframes, transition] of motions) {
      expect(Object.keys(keyframes)).toEqual(['opacity'])
      expect(transition.duration).toBeLessThanOrEqual(0.2)
    }
    to.mockRestore()
  })
})
