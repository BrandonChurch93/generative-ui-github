import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { chartLabel, LineChart } from './LineChart'
import type { LineChartProps } from './schema'
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
afterEach(cleanup)

const props = sample.props as LineChartProps
const twoSeries = sample.variants[1]!.props as LineChartProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof LineChart>[0]> = {}) =>
  render(
    <LineChart
      props={state === 'empty' ? (sample.empty as LineChartProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('LineChart', () => {
  it('default: zero-based ticks, one line, the endpoint and end label, the failure strip and the finding as its label', () => {
    const { container } = view('default')
    expect([...container.querySelectorAll('[data-tick]')].map(t => t.textContent)).toEqual(['20', '15', '10', '5', '0'])
    expect(container.querySelectorAll('[data-line]')).toHaveLength(1)
    expect(container.querySelector('[data-end-label]')?.textContent).toBe('18.4min')
    expect(container.querySelectorAll('[data-column]')).toHaveLength(12)
    expect(screen.getByRole('img', { name: props.finding })).toBeTruthy()
    expect(container.querySelector('table[data-table-view]')?.querySelectorAll('tbody tr')).toHaveLength(12)
  })

  it('two series: data-1 on top, a legend naming both, both ends labeled when they do not touch', () => {
    const { container } = render(<LineChart props={twoSeries} state="default" />)
    const lines = [...container.querySelectorAll('[data-line]')].map(l => l.getAttribute('data-series'))
    expect(lines).toEqual(['1', '0'])
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('[data-end-label]')).toHaveLength(2)
  })

  it('skeleton: busy, gridlines but no line, no endpoint', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-line]')).toBeNull()
    expect(container.querySelector('[data-endpoint]')).toBeNull()
  })

  it('empty: one row, no axis and no ticks', () => {
    const { container } = view('empty')
    expect(screen.getByText('No full week of runs yet')).toBeTruthy()
    expect(container.querySelector('[data-tick]')).toBeNull()
  })

  it('error: the unavailable mark and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting commit activity')).toBeTruthy()
    expect(container.querySelector('[data-progress]')).toBeTruthy()
  })

  it('arrow keys step the crosshair a week at a time and announce it', () => {
    view('default')
    const plot = screen.getByRole('img')
    fireEvent.keyDown(plot, { key: 'End' })
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(screen.getByText(/Week of Sep 28: Duration 17.6 min, 11 failed runs/)).toBeTruthy()
  })

  it('a finding whose numbers do not match the series never becomes the label', () => {
    expect(chartLabel({ ...props, finding: 'CI got 80% slower in 12 weeks.' })).toBe('CI duration over 12 weeks, latest 18.4 min.')
  })
})
