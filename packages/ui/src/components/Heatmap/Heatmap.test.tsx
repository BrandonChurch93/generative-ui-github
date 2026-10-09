import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { heatmapLabel, peakLine, stepOf } from './heat'
import { Heatmap } from './Heatmap'
import { heatmapSchema, heatmapSpec, type HeatmapProps } from './schema'
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

const props = sample.props as HeatmapProps
const sparse = sample.variants[0]!.props as HeatmapProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Heatmap>[0]> = {}) =>
  render(
    <Heatmap
      props={state === 'empty' ? (sample.empty as HeatmapProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('Heatmap', () => {
  it('default: seven rows of 24 Monday first, the peak dot, the legend, the summary as the label and the table', () => {
    const { container } = view('default')
    expect(screen.getAllByRole('row')).toHaveLength(7 + 8)
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(168)
    expect(container.querySelector('[data-row="1"] [data-hour="14"] [data-peak-dot]')).toBeTruthy()
    expect(container.querySelectorAll('[data-peak-dot]')).toHaveLength(1)
    expect(container.querySelector('[data-legend-high]')?.textContent).toBe('38')
    expect(screen.getByText('Peak · Tue 14:00 · 38 reviews')).toBeTruthy()
    expect(screen.getByRole('group', { name: props.summary })).toBeTruthy()
    expect(screen.getByText('last 12 weeks · MDT')).toBeTruthy()
    expect(container.querySelector('table[data-table-view] tbody tr th')?.textContent).toBe('Monday')
  })

  it('sparse: one event sits two steps from empty and the peak is step 5', () => {
    const { container } = render(<Heatmap props={sparse} state="default" />)
    expect(container.querySelector('[data-row="0"] [data-hour="9"]')?.getAttribute('data-step')).toBe('2')
    expect(container.querySelector('[data-row="2"] [data-hour="10"]')?.getAttribute('data-step')).toBe('5')
    expect(container.querySelector('[data-row="0"] [data-hour="0"]')?.getAttribute('data-step')).toBe('0')
    expect(stepOf(1, 38)).toBe(1)
  })

  it('skeleton: busy, seven row bars and no cells', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-cell]')).toBeNull()
    expect(screen.getByText('Loading When reviews happen.')).toBeTruthy()
  })

  it('empty: the header and one row, no grid', () => {
    view('empty')
    expect(screen.getByText('No reviews in the last 12 weeks')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()
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
    expect(screen.getByText('GitHub is counting commits by hour')).toBeTruthy()
    expect(container.querySelector('[data-progress]')).toBeTruthy()
  })

  it('one tab stop enters at the peak; arrows, Home and End move it and the tooltip follows', () => {
    const { container } = view('default')
    const stops = container.querySelectorAll('[tabindex="0"]')
    expect(stops).toHaveLength(1)
    const peak = screen.getByRole('gridcell', { name: 'Tuesday 14:00, 38 reviews' })
    expect(peak.getAttribute('tabindex')).toBe('0')
    peak.focus()
    fireEvent.keyDown(peak, { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Wednesday 14:00, 25 reviews')
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Wednesday 23:00, 0 reviews')
    expect(container.querySelector('[data-tip]')?.textContent).toBe('0reviewsWed 23:00')
  })

  it('a cell click asks the filled pattern through onAsk', () => {
    const onAsk = vi.fn()
    view('default', { onAsk })
    fireEvent.click(screen.getByRole('button', { name: 'Thursday 10:00, 27 reviews' }))
    expect(onAsk).toHaveBeenCalledWith('Which pull requests were reviewed on Thursdays around 10:00?')
  })

  it('ties put the dot on every tied cell and the footer names the first', () => {
    const counts = sparse.counts.map(r => [...r])
    counts[4]![13] = 4
    expect(peakLine(counts, 'commits')).toBe('Peak · Wed 10:00 and 1 more · 4 commits')
    const { container } = render(<Heatmap props={{ ...sparse, counts }} state="default" />)
    expect(container.querySelectorAll('[data-peak-dot]')).toHaveLength(2)
  })

  it('a summary whose numbers miss the counts never becomes the label', () => {
    expect(heatmapLabel({ ...props, summary: 'Reviews peak Tuesday at 14:00 with 41 reviews.' })).toBe(
      'Reviews peak Tuesday at 14:00 with 38 in the last 12 weeks.',
    )
    expect(heatmapLabel({ ...props, summary: 'Reviews peak Tuesday at 14:00 with 38 reviews in 12 weeks.' })).toBe(
      'Reviews peak Tuesday at 14:00 with 38 reviews in 12 weeks.',
    )
    expect(heatmapLabel({ ...props, summary: 'Reviews peak Tuesday at 26:00.' })).not.toContain('26:00')
  })

  it('schema: the example validates and pixel values or unknown units do not', () => {
    expect(heatmapSchema.safeParse(heatmapSpec.example).success).toBe(true)
    expect(heatmapSchema.safeParse({ ...heatmapSpec.example, unit: 'pushes' }).success).toBe(false)
    expect(heatmapSchema.safeParse({ ...heatmapSpec.example, cellSize: 20 }).success).toBe(false)
  })
})
