import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { Progress } from './Progress'
import { progressSchema, progressSpec, type ProgressProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as ProgressProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Progress>[0]> = {}) =>
  render(<Progress props={state === 'empty' ? (sample.empty as ProgressProps) : props} state={state} error={sample.error} {...extra} />)

describe('Progress', () => {
  it('default: the label, the figure with its "of N", the share in system words, and the track filled to it', () => {
    const { container } = view('default')
    expect(screen.getByText('Open on v16.2')).toBeTruthy()
    expect(container.querySelector('[data-number]')?.textContent).toBe('12')
    expect(container.querySelector('[data-suffix]')?.textContent).toBe('of 40')
    expect(screen.getByText(/% open · milestone v16.2 · due Oct 30/).textContent).toBe('30% open · milestone v16.2 · due Oct 30')
    expect(container.querySelector('[data-fill]')?.getAttribute('style')).toContain('--share: 0.3')
  })

  it('skeleton: busy, no figure and no track', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-number]')).toBeNull()
    expect(container.querySelector('[data-fill]')).toBeNull()
    expect(screen.getByText('Loading Open on v16.2.')).toBeTruthy()
  })

  it('empty: a whole of zero shows the neutral mark and the system line, no track', () => {
    const { container } = view('empty')
    expect(screen.getByText('No issues on this milestone yet')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
    expect(container.querySelector('[data-fill]')).toBeNull()
  })

  it('error: the unavailable mark, the cause and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText('GitHub returned 502')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming is omitted with its reason: no count-of-total measure reads a stats endpoint', () => {
    expect(progressSpec.statesOmitted?.map(s => s.state)).toEqual(['warming'])
  })

  it('a zero part is data: the figure 0 and an empty track, not the empty state', () => {
    const { container } = render(<Progress props={sample.variants[1]!.props as ProgressProps} state="default" />)
    expect(container.querySelector('[data-number]')?.textContent).toBe('0')
    expect(container.querySelector('[data-fill]')?.getAttribute('style')).toContain('--share: 0')
  })

  it('with a follow-up question the whole card is the button', () => {
    const onAsk = vi.fn()
    render(<Progress props={props} state="default" ask="What is still open on v16.2?" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onAsk).toHaveBeenCalledWith('What is still open on v16.2?')
  })

  it('only a part-of-a-whole measure is accepted', () => {
    expect(progressSchema.safeParse(progressSpec.example).success).toBe(true)
    expect(progressSchema.safeParse({ measure: 'prs-merged', label: 'Merged' }).success).toBe(false)
  })
})
