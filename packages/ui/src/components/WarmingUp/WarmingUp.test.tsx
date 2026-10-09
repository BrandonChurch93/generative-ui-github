import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { laneFor } from './lanes'
import { warmingUpSchema, warmingUpSpec, type WarmingUpProps } from './schema'
import { WarmingUp } from './WarmingUp'
import sample from './sample.json'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const retry = sample.props as WarmingUpProps
const variant = (label: string) => sample.variants.find(v => v.label.startsWith(label))!.props as WarmingUpProps
const view = (props: WarmingUpProps, state: ComponentState = 'default', extra: Partial<Parameters<typeof WarmingUp>[0]> = {}) =>
  render(<WarmingUp props={props} state={state} error={sample.error} {...extra} />)

const statusOf = (container: HTMLElement, id: string) => container.querySelector(`[data-row="${id}"] [data-status]`)?.textContent
const headOf = (container: HTMLElement, id: string) => container.querySelector(`[data-row="${id}"] [data-lane] [data-mark]`)?.getAttribute('data-kind')

describe('WarmingUp', () => {
  it('default (retry): the still-counting lead, the countdown, one counting lane per statistic and a busy region', () => {
    const { container } = view(retry)
    expect(screen.getByText('vercel/next.js', { selector: 'code' }).parentElement?.textContent).toBe('GitHub is still counting vercel/next.js.')
    expect(screen.getByText('attempt 5 · checking again in 7s')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'What GitHub is counting' })).toBeTruthy()
    expect(container.querySelector('[data-card-head]')?.textContent).toContain('0 of 4 ready')
    expect(container.querySelectorAll('[data-row]')).toHaveLength(4)
    expect(statusOf(container, 'contributors')).toBe('counting')
    expect(headOf(container, 'contributors')).toBe('warming')
    // Checks at 0, 4, 10, 18 and 28 seconds: five waits, the last one open on the clock.
    expect(container.querySelectorAll('[data-row="contributors"] [data-seg]')).toHaveLength(5)
    expect([...container.querySelectorAll('[data-tick]')].map(t => t.textContent)).toEqual(['0s', '15s', '30s', '45s', '60s'])
    expect(screen.getByRole('region', { name: 'Warming up' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('Still counting vercel/next.js. Attempt 5. Checking again in 7 seconds.')
  })

  it('first visit: says it is the first time and only happens once per repo, on a 30s axis', () => {
    const { container } = view(variant('First visit'))
    expect(screen.getByText(/for the first time\.$/).textContent).toBe('GitHub is counting facebook/react for the first time.')
    expect(screen.getByText(/only happens once per repo/)).toBeTruthy()
    expect([...container.querySelectorAll('[data-tick]')].map(t => t.textContent)).toEqual(['0s', '10s', '20s', '30s'])
    expect(screen.getByRole('status').textContent).toBe('GitHub is counting facebook/react. Nothing is ready yet. Checking again in 3 seconds.')
  })

  it('partly ready: landed lanes settle with the good mark and a ready tag, the lead names what is still counting, the bar holds their share', () => {
    const { container } = view(variant('Partly ready'))
    expect(screen.getByText('GitHub is still counting contributors and participation.')).toBeTruthy()
    expect(screen.getByText(/^Commit activity and the punch card are in, and their parts of the answer are below\./)).toBeTruthy()
    expect(statusOf(container, 'commit_activity')).toBe('ready')
    expect(headOf(container, 'commit_activity')).toBe('good')
    expect(container.querySelector('[data-row="commit_activity"]')?.hasAttribute('data-settled')).toBe(true)
    expect(container.querySelector('[data-card-head]')?.textContent).toContain('2 of 4 ready')
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.5')
    expect(screen.getByRole('status').textContent).toBe('Commit activity and the punch card are ready. Still counting contributors and participation.')
  })

  it('stopped: unavailable lead mark, the cached copy with its date and the neutral mark, the missing one left out, Try again', () => {
    const onRetry = vi.fn()
    const { container } = view(variant('Stopped'), 'default', { onRetry })
    expect(screen.getByText(/after 2 minutes\.$/).textContent).toBe("GitHub hasn't finished counting vercel/next.js after 2 minutes.")
    expect(
      screen.getByText(
        'Contributors is shown from a copy counted 3 days ago. Participation has no earlier copy, so it is left out until GitHub finishes.',
      ),
    ).toBeTruthy()
    expect(container.querySelector('[data-lead] [data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(statusOf(container, 'contributors')).toBe('cached')
    expect(headOf(container, 'contributors')).toBe('neutral')
    expect(screen.getByText('stats/contributors · copy from Oct 5')).toBeTruthy()
    expect(statusOf(container, 'participation')).toBe('not ready')
    expect(headOf(container, 'participation')).toBe('unavailable')
    expect(container.querySelector('[data-card-head]')?.textContent).toContain('2 ready · 1 cached · 1 not ready')
    expect(screen.getByRole('region', { name: 'Warming up' }).hasAttribute('aria-busy')).toBe(false)
    expect(container.querySelector('[data-crit], [data-kind="crit"], [data-tone="crit"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('error: the card frame stays with the unavailable mark, what failed, the cause and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view(retry, 'error', { onRetry })
    expect(screen.getByRole('heading', { name: 'What GitHub is counting' })).toBeTruthy()
    expect(screen.getByText("Couldn't check what GitHub is counting")).toBeTruthy()
    expect(screen.getByText('GitHub returned 502 · tried twice')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('counts down each second to "checking now" without the status line speaking again', () => {
    vi.useFakeTimers()
    view(retry)
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('attempt 5 · checking again in 6s')).toBeTruthy()
    act(() => vi.advanceTimersByTime(6000))
    expect(screen.getByText('attempt 5 · checking now')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Still counting vercel/next.js. Attempt 5. Checking again in 7 seconds.')
  })

  it('a settled lane ends where its statistic landed, with a gap at every check before it', () => {
    const partly = variant('Partly ready')
    expect(laneFor(partly.stats[3]!, partly)).toEqual({ settled: true, end: 18, segments: [[0, 4], [4, 10], [10, 18]] })
    const stopped = variant('Stopped')
    expect(laneFor(stopped.stats[0]!, stopped).segments.at(-1)).toEqual([90, 120])
  })

  it('every sample validates against the WarmingStatus schema, and the spec is system only', () => {
    for (const props of [retry, ...sample.variants.map(v => v.props)]) expect(warmingUpSchema.safeParse(props).success).toBe(true)
    expect(warmingUpSchema.safeParse({ ...retry, tone: 'crit' }).success).toBe(false)
    expect(warmingUpSpec.pickable).toBe(false)
  })
})
