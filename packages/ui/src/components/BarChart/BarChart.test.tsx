import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { BarChart, chartLabel } from './BarChart'
import { barChartSchema, barChartSpec, type BarChartProps } from './schema'
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

const props = sample.props as BarChartProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof BarChart>[0]> = {}) =>
  render(
    <BarChart
      props={state === 'empty' ? (sample.empty as BarChartProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('BarChart', () => {
  it('default: zero-based round ticks, one bar per category with its label, the finding as the label, a hidden table', () => {
    const { container } = view('default')
    expect([...container.querySelectorAll('[data-tick]')].map(t => t.textContent)).toEqual(['24', '18', '12', '6', '0'])
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(8)
    expect(container.querySelector('[data-bar="bug"]')?.getAttribute('style')).toContain('height: 95.83')
    expect(container.querySelector('[title="create-next-app"]')?.textContent).toBe('create-next-app')
    expect(screen.getByRole('img', { name: props.finding })).toBeTruthy()
    expect(container.querySelector('table[data-table-view]')?.querySelectorAll('tbody tr')).toHaveLength(8)
  })

  it('skeleton: busy, gridlines and label blocks, no bars', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-bar]')).toBeNull()
    expect(screen.getByText('Loading Stale issues by label.')).toBeTruthy()
  })

  it('empty: one row with the good mark the system chose, no ticks', () => {
    const { container } = view('empty')
    expect(screen.getByText('No stale issues')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('good')
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
    expect(screen.getByText('GitHub is counting commits by author')).toBeTruthy()
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.34')
  })

  it('a zero is a bar on the baseline, not a missing one', () => {
    const twelve = sample.variants[1]!.props as BarChartProps
    const { container } = render(<BarChart props={twelve} state="default" />)
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(12)
    expect(container.querySelector('[data-bar="packages/eslint"]')?.getAttribute('style')).toContain('height: 0%')
  })

  it('arrow keys step from bar to bar and announce each', () => {
    view('default')
    const plot = screen.getByRole('img')
    fireEvent.keyDown(plot, { key: 'Home' })
    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    expect(screen.getByText('Turbopack: 11')).toBeTruthy()
  })

  it('a finding whose numbers do not match the bars never becomes the label', () => {
    expect(chartLabel({ ...props, finding: 'Bug reports hold 40 of the stale issues.' })).toBe(
      'Stale issues by label across 8 labels, the largest bug at 23.',
    )
  })

  it('the model names a measure and a grouping, never the bars', () => {
    expect(barChartSchema.safeParse(barChartSpec.example).success).toBe(true)
    expect(barChartSchema.safeParse({ ...barChartSpec.example, bars: props.bars }).success).toBe(false)
  })
})
