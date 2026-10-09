import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { Metric } from './Metric'
import type { MetricProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as MetricProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Metric>[0]> = {}) =>
  render(
    <Metric
      props={state === 'empty' ? (sample.empty as MetricProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('Metric', () => {
  it('default: label, number, suffix, delta in its tone, the trend and the bar', () => {
    const { container } = view('default')
    expect(screen.getByText('Median review wait')).toBeTruthy()
    expect(container.querySelector('[data-number]')?.textContent).toBe('19.6')
    expect(container.querySelector('[data-suffix]')?.textContent).toBe('h')
    expect(screen.getByText('up from 14.2h in August').parentElement?.getAttribute('data-tone')).toBe('crit')
    expect(screen.getByRole('img', { name: 'Up from 12.8 to 19.6 hours over 12 weeks' })).toBeTruthy()
    expect(container.querySelector('[data-bar]')).toBeTruthy()
  })

  it('skeleton: the frame and label slot render, busy, with no number and no bar', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-number]')).toBeNull()
    expect(container.querySelector('[data-bar]')).toBeNull()
    expect(screen.getByText('Loading Median review wait.')).toBeTruthy()
  })

  it('empty: a neutral mark and the system message, the window below, no bar', () => {
    const { container } = view('empty')
    expect(screen.getByText('No reviews yet')).toBeTruthy()
    expect(screen.getByText('window · last 30 days')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
    expect(container.querySelector('[data-bar]')).toBeNull()
  })

  it('error: the unavailable mark, never crit, and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(container.querySelector('[data-hot]')).toBeNull()
    expect(screen.getByText('GitHub returned 502')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming mark, the next check, and the bar filling on its track', () => {
    const { container } = view('warming')
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('warming')
    expect(screen.getByText('usually under a minute')).toBeTruthy()
    expect(container.querySelector('[data-bar]')?.getAttribute('style')).toContain('--progress: 0.42')
  })

  it('hot carries a hidden "Blocking." and a crit mark; a zero is a number, not empty', () => {
    const { container } = render(
      <Metric props={{ ...props, value: 0, hot: true, series: undefined }} state="default" />,
    )
    expect(screen.getByText('Blocking.')).toBeTruthy()
    expect(container.querySelector('[data-mark][data-kind="crit"]')).toBeTruthy()
    expect(container.querySelector('[data-number]')?.textContent).toBe('0')
  })

  it('with a follow-up question the whole card is the button', () => {
    const onAsk = vi.fn()
    render(<Metric props={props} state="default" ask="Why is review wait up?" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onAsk).toHaveBeenCalledWith('Why is review wait up?')
  })
})
