import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { groupByDay, relativeTime } from './days'
import type { TimelineProps } from './schema'
import { Timeline } from './Timeline'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as TimelineProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Timeline>[0]> = {}) =>
  render(
    <Timeline
      props={state === 'empty' ? (sample.empty as TimelineProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('Timeline', () => {
  it('default: grouped by day with system headings, the newest node is the accent endpoint, one spine', () => {
    const { container } = view('default')
    expect([...container.querySelectorAll('h3')].map(h => h.textContent)).toEqual(['Today', 'Fri Oct 2', 'Wed Sep 30'])
    expect(container.querySelectorAll('[data-row]')).toHaveLength(5)
    expect(container.querySelectorAll('[data-kind="endpoint"]')).toHaveLength(1)
    expect(container.querySelector('[data-row="84112"] [data-kind="endpoint"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-spine]')).toHaveLength(1)
    expect(screen.getByText('184 lines added, 42 removed')).toBeTruthy()
    expect(container.querySelector('[data-row="84112"] time')?.textContent).toBe('2h ago')
  })

  it('skeleton: busy, placeholder rows, no spine and no accent', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-spine]')).toBeNull()
    expect(container.querySelector('[data-kind="endpoint"]')).toBeNull()
  })

  it('empty: one row with the mark in the node column, no heading, no spine', () => {
    const { container } = view('empty')
    expect(screen.getByText('Nothing merged into v17.0 yet')).toBeTruthy()
    expect(container.querySelector('h3')).toBeNull()
    expect(container.querySelector('[data-spine]')).toBeNull()
  })

  it('error: the unavailable mark and Try again, never crit', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar filling', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting line changes')).toBeTruthy()
    expect(container.querySelector('[data-progress]')).toBeTruthy()
  })

  it('a day heading asks dayAsk with the day filled in', () => {
    const onAsk = vi.fn()
    view('default', { onAsk })
    fireEvent.click(screen.getByRole('button', { name: 'Fri Oct 2' }))
    expect(onAsk).toHaveBeenCalledWith('What merged on Fri Oct 2?')
  })

  it('a single item is one node and one row, never a dangling spine', () => {
    const { container } = render(<Timeline props={{ ...props, items: props.items.slice(0, 1) }} state="default" />)
    expect(container.querySelector('[data-spine]')).toBeNull()
  })

  it('writes Yesterday and relative times in the viewer zone', () => {
    const days = groupByDay([{ ...props.items[0]!, when: '2026-10-03T20:00:00Z' }], props.now, 'UTC')
    expect(days[0]!.heading).toBe('Yesterday')
    expect(relativeTime('2026-10-01T18:00:00Z', props.now)).toBe('3d ago')
  })
})
