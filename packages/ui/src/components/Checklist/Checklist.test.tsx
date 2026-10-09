import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { Checklist } from './Checklist'
import { checklistSpec, type ChecklistProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as ChecklistProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Checklist>[0]> = {}) =>
  render(
    <Checklist
      props={state === 'empty' ? (sample.empty as ChecklistProps) : props}
      state={state}
      error={sample.error}
      {...extra}
    />,
  )

describe('Checklist', () => {
  it('default: the ring at the share passed, the tally, one row per check with system tag words and marks', () => {
    const { container } = view('default')
    expect(screen.getByRole('heading', { name: 'Community standards' })).toBeTruthy()
    expect(container.querySelector('[data-ring]')?.getAttribute('style')).toContain('--share: 0.666')
    expect(container.querySelector('[data-number]')?.textContent).toBe('4')
    expect(screen.getByText('of 6')).toBeTruthy()
    expect(screen.getByText('standards in place')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(6)
    expect(screen.getAllByText('present')).toHaveLength(4)
    expect(screen.getAllByText('missing')).toHaveLength(2)
    expect([...container.querySelectorAll('[data-row] [data-mark]')].map(m => m.getAttribute('data-kind'))).toEqual([
      'good',
      'good',
      'good',
      'good',
      'neutral',
      'neutral',
    ])
  })

  it('skeleton: busy, placeholder rows, no ring drawn from data', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-ring]')).toBeNull()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
    expect(screen.getByText('Loading Community standards.')).toBeTruthy()
  })

  it('empty: one row with the system sentence for the source, no ring', () => {
    const { container } = view('empty')
    expect(screen.getByText('Nothing on this milestone yet')).toBeTruthy()
    expect(screen.getByText('milestone created Oct 6 · no issues or pull requests yet')).toBeTruthy()
    expect(container.querySelector('[data-ring]')).toBeNull()
  })

  it('error: the header stays, the unavailable mark and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'Community standards' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming is omitted with its reason: no stats endpoint behind any source', () => {
    expect(checklistSpec.statesOmitted?.map(s => s.state)).toEqual(['warming'])
  })

  it('a check with a follow-up question is a button that asks it; one with a url links out', () => {
    const onAsk = vi.fn()
    render(<Checklist props={props} state="default" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button', { name: /Pull request template/ }))
    expect(onAsk).toHaveBeenCalledWith('What should a pull request template ask for?')
    expect(screen.getByRole('link', { name: /Contributing guide/ }).getAttribute('href')).toContain('contributing.md')
  })

  it('none passed is data: an empty ring and a zero, not the empty state', () => {
    const none = { ...props, items: props.items.map(i => ({ ...i, passed: false })) }
    const { container } = render(<Checklist props={none} state="default" />)
    expect(container.querySelector('[data-number]')?.textContent).toBe('0')
    expect(container.querySelector('[data-ring]')?.getAttribute('style')).toContain('--share: 0')
  })
})
