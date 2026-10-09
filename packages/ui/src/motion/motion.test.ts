import { gsap } from 'gsap'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INTERACTION } from './motion'
import { bloom, count, draw, extend, formatCount, rise, slide, wipe } from './primitives'

const div = () => document.createElement('div')

function firstTween(tl: gsap.core.Timeline): gsap.core.Tween {
  return tl.getChildren(true, true, false)[0] as gsap.core.Tween
}

function path(length: number): SVGPathElement {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  Object.defineProperty(p, 'getTotalLength', { value: () => length })
  return p
}

afterEach(() => {
  gsap.globalTimeline.clear()
  vi.unstubAllGlobals()
})

type Make = (reduced?: boolean) => gsap.core.Timeline

const moves: [string, Make, number, string][] = [
  ['wipe in', r => wipe(div(), { reduced: r }), 0.9, 'power3.inOut'],
  ['wipe out', r => wipe(div(), { direction: 'out', reduced: r }), 0.5, 'power3.inOut'],
  ['extend in', r => extend(div(), { reduced: r }), 0.7, 'power3.inOut'],
  ['extend out', r => extend(div(), { direction: 'out', reduced: r }), 0.35, 'power3.inOut'],
  ['slide in', r => slide(div(), { reduced: r }), 0.5, 'power3.out'],
  ['slide out', r => slide(div(), { direction: 'out', reduced: r }), 0.35, 'power2.in'],
  ['draw in', r => draw(path(120), { reduced: r }), 1.1, 'power2.inOut'],
  ['draw out', r => draw(path(120), { direction: 'out', reduced: r }), 0.5, 'power2.inOut'],
  ['count', r => count(div(), { from: 1, to: 2, reduced: r }), 0.8, 'power2.out'],
  ['rise in', r => rise(div(), { reduced: r }), 0.55, 'power3.out'],
  ['rise out', r => rise(div(), { direction: 'out', reduced: r }), 0.35, 'power2.in'],
]

describe('motion primitives', () => {
  it.each(moves)('%s runs its motion.md duration and ease', (_, make, duration, ease) => {
    const tl = make(false)
    expect(tl.duration()).toBeCloseTo(duration, 5)
    expect(firstTween(tl).vars.ease).toBe(ease)
  })

  it('bloom rises 700ms and settles 700ms', () => {
    const tl = bloom(div(), { reduced: false })
    expect(tl.duration()).toBeCloseTo(1.4, 5)
    expect(tl.getChildren(true, true, false).map(t => (t as gsap.core.Tween).vars.ease)).toEqual(['power2.out', 'power2.out'])
  })

  it('slide staggers rows 70ms apart, top to bottom', () => {
    expect(slide([div(), div(), div()], { reduced: false }).duration()).toBeCloseTo(0.5 + 2 * 0.07, 5)
  })

  it('count runs tabular with one decimal at most', () => {
    const el = div()
    count(el, { from: 14.2, to: 19.6, reduced: false }).progress(1)
    expect(el.textContent).toBe('19.6')
    expect(formatCount(12345.67, 0)).toBe('12,346')
  })
})

describe('reduced motion', () => {
  const withBloom: [string, Make][] = [...moves.map(([name, make]) => [name, make] as [string, Make]), ['bloom', r => bloom(div(), { reduced: r })]]

  it.each(withBloom)('%s collapses to a 200ms opacity change when the media query matches', (_, make) => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }))
    const tl = make(undefined)
    expect(tl.duration()).toBeCloseTo(0.2, 5)
    const vars = firstTween(tl).vars
    expect(vars).toHaveProperty('opacity')
    for (const moving of ['x', 'y', 'scale', 'scaleX', 'scaleY', 'clipPath', 'strokeDashoffset']) expect(vars).not.toHaveProperty(moving)
  })

  it('a count jumps to its final value', () => {
    const el = div()
    count(el, { from: 1, to: 2, reduced: true })
    expect(el.textContent).toBe('2')
  })
})

describe('interaction speed', () => {
  it('holds the four interaction durations', () => {
    expect(INTERACTION.messageWipe).toBe(0.35)
    expect(INTERACTION.menu).toBe(0.18)
    expect(INTERACTION.fold).toBe(0.35)
    expect(INTERACTION.chipChoose.min).toBe(0.15)
    expect(INTERACTION.chipChoose.max).toBe(0.2)
  })
})
