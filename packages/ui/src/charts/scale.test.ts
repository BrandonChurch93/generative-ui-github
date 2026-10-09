import { describe, expect, it } from 'vitest'
import { isLabeled, labelEvery, linePath, niceScale } from './scale'

describe('chart scale', () => {
  it('is zero-based with four round intervals', () => {
    expect(niceScale(18.4)).toEqual({ max: 20, step: 5, ticks: [0, 5, 10, 15, 20] })
    expect(niceScale(41).ticks).toEqual([0, 12, 24, 36, 48])
    expect(niceScale(0).ticks).toEqual([0, 1, 2, 3, 4])
  })

  it('thins week labels from the latest week back', () => {
    expect(labelEvery(80, 64)).toBe(1)
    expect(labelEvery(40, 64)).toBe(2)
    expect(labelEvery(26, 64)).toBe(3)
    const labeled = Array.from({ length: 12 }, (_, i) => i).filter(i => isLabeled(i, 12, 2))
    expect(labeled).toEqual([1, 3, 5, 7, 9, 11])
  })

  it('breaks the line at a missing week', () => {
    expect(linePath([10, null, 20], 20)).toBe('M16.667 50.000 M83.333 0.000')
  })
})
