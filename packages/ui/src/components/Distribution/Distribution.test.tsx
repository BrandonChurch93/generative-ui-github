import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { Distribution } from './Distribution'
import { distributionSchema, distributionSpec, findingSentence, roundDuration, shortDuration, type DistributionProps } from './schema'
import sample from './sample.json'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const props = sample.props as DistributionProps
const variant = (i: number) => sample.variants[i]!.props as DistributionProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Distribution>[0]> = {}) =>
  render(
    <Distribution
      props={state === 'empty' ? (sample.empty as DistributionProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )
const text = (root: HTMLElement, selector: string) => root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim()

describe('Distribution', () => {
  it('default, wide: seven bins in words, the finding as the group label, the median at its bin center, p90, counts and source', () => {
    const { container } = view('default')
    expect(screen.getByRole('group', { name: 'Half of first-time contributors got a first review within 19 hours. 1 in 10 waited more than 6 days.' })).toBeTruthy()
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
      '22 PRs reviewed in under 1 hour',
      '32 PRs reviewed in 1 to 4 hours',
      '38 PRs reviewed in 4 to 12 hours',
      '48 PRs reviewed in 12 to 24 hours',
      '50 PRs reviewed in 1 to 3 days',
      '33 PRs reviewed in 3 to 7 days',
      '17 PRs waited over 7 days',
    ])
    expect(text(container, '[data-marker-label]')).toBe('You would wait here · about 19h')
    expect((container.querySelector('[data-marker]') as HTMLElement).style.left).toBe('50%')
    expect(text(container, '[data-p90-label]')).toBe('90% by 6d')
    expect([...container.querySelectorAll('[data-tick]')].map(t => t.textContent)).toEqual(['20', '40'])
    expect(text(container, '[data-source]')).toBe('from 240 PRs by first-time contributors · bots excluded')
    expect(container.querySelector('table[data-table-view]')?.querySelectorAll('tbody tr')).toHaveLength(7)
  })

  it('narrow: no counts, gridlines or p90 rule; the short marker label and p90 in the source line', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 360 } as DOMRect)
    const { container } = view('default')
    expect(container.querySelector('[data-tick], [data-gridline], [data-p90]')).toBeNull()
    expect(text(container, '[data-marker-label]')).toBe('Your wait · about 19h')
    expect(text(container, '[data-source]')).toBe('90% reviewed by 6d · from 240 PRs')
  })

  it('neutral perspective says Median; a merge source names no bots', () => {
    const { container } = render(<Distribution props={variant(0)} state="default" />)
    expect(text(container, '[data-marker-label]')).toBe('Median · about 21h')
    expect(text(container, '[data-source]')).toBe('from 312 PRs')
  })

  it('a zero is data: one bar and six empty bins, minutes in the label, no p90 when the model turned it off', () => {
    const { container } = render(<Distribution props={variant(1)} state="default" />)
    const heights = [...container.querySelectorAll<HTMLElement>('[data-bar]')].map(b => b.style.height)
    expect(heights.filter(h => h !== '0%')).toHaveLength(1)
    expect(text(container, '[data-marker-label]')).toBe('Median · about 18 min')
    expect(container.querySelector('[data-p90]')).toBeNull()
  })

  it('skeleton: busy, seven bar blocks, no baseline, grid or marker', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText('Loading Time to first review.')).toBeTruthy()
    expect(container.querySelectorAll('[data-skeleton]').length).toBeGreaterThanOrEqual(7)
    expect(container.querySelector('[data-baseline], [data-gridline], [data-marker]')).toBeNull()
  })

  it('empty: one row with the sentence and what is still open, no axis', () => {
    const { container } = view('empty')
    expect(screen.getByText('No first-time contributor PRs reviewed yet')).toBeTruthy()
    expect(screen.getByText('2 still open · oldest waiting 5d')).toBeTruthy()
    expect(container.querySelector('[data-baseline], [data-edge]')).toBeNull()
  })

  it('error: the unavailable mark and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText("Couldn't load review times")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting review times')).toBeTruthy()
    expect(container.querySelector('[data-progress]')).toBeTruthy()
  })

  it('one tab stop; arrow keys move between bins and focus shows the tooltip and lights the bin edges', () => {
    const { container } = view('default')
    const bins = screen.getAllByRole('button')
    expect(bins.filter(b => b.tabIndex === 0)).toHaveLength(1)
    bins[0]!.focus()
    fireEvent.keyDown(bins[0]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(bins[1])
    expect(screen.getByText('1 to 4h · 13%')).toBeTruthy()
    expect([...container.querySelectorAll('[data-edge][data-on]')].map(e => e.textContent)).toEqual(['1h', '4h'])
  })

  it('counts that do not fit the ladder render the error row, never a broken chart', () => {
    render(<Distribution props={{ ...props, counts: [1, 2, 3] }} state="default" />)
    expect(screen.getByText("Couldn't draw this chart")).toBeTruthy()
  })

  it('durations round to minutes under an hour, hours under two days, days after', () => {
    expect([30, 59.6, 1140, 2850, 8640].map(m => shortDuration(roundDuration(m)))).toEqual(['30 min', '1h', '19h', '2d', '6d'])
    expect(findingSentence(variant(0))).toBe('Half of PRs merged within 21 hours. 1 in 10 took more than 6 days.')
  })

  it('the model schema accepts the example and rejects bins or wording it may not send', () => {
    expect(distributionSchema.safeParse(distributionSpec.example).success).toBe(true)
    expect(distributionSchema.safeParse({ ...distributionSpec.example, counts: [1, 2] }).success).toBe(false)
  })
})
