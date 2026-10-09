import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { ActivityFeed } from './ActivityFeed'
import { activityFeedSchema, activityFeedSpec, type ActivityFeedProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as ActivityFeedProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof ActivityFeed>[0]> = {}) =>
  render(<ActivityFeed props={state === 'empty' ? (sample.empty as ActivityFeedProps) : props} state={state} error={sample.error} {...extra} />)

describe('ActivityFeed', () => {
  it('default: one row per event, actor then the system verb then the object, ref and relative time in meta, newest is the endpoint', () => {
    const { container } = view('default')
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(6)
    const second = container.querySelector('[data-row="e-899"]')!
    expect(second.textContent).toContain('tkato requested changes on Cache components')
    expect(second.textContent).toContain('#84077 · 5h ago')
    expect(container.querySelectorAll('[data-kind="endpoint"]')).toHaveLength(1)
    expect(container.querySelector('[data-row="e-901"] [data-kind="endpoint"]')).toBeTruthy()
    // A ref that only repeats the title is not written twice.
    expect(container.querySelector('[data-row="e-890"] [datetime]')?.parentElement?.textContent).toBe('1d ago')
  })

  it('skeleton: busy frame, placeholder rows, a hidden loading sentence', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
    expect(screen.getByText('Loading recent activity.')).toBeTruthy()
  })

  it('empty: the header stays, one row with the system sentence and its meta', () => {
    const { container } = view('empty')
    expect(screen.getByRole('heading', { name: 'Activity on v17.0' })).toBeTruthy()
    expect(screen.getByText('Nothing happened on v17.0 in the last 7 days')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
  })

  it('error: the header stays, the unavailable mark, the cause and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText('GitHub returned 502 · tried twice')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: omitted with a reason; a stray warming state waits as a skeleton, never a 202 row', () => {
    expect(activityFeedSpec.statesOmitted?.map(s => s.state)).toEqual(['warming'])
    const { container } = view('warming')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-state="warming"]')).toBeNull()
  })

  it('a row with a follow-up question is a button that asks it', () => {
    const onAsk = vi.fn()
    render(<ActivityFeed props={sample.variants[0]!.props as ActivityFeedProps} state="default" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button', { name: /hgrey approved/ }))
    expect(onAsk).toHaveBeenCalledWith('What did hgrey say about #84120?')
  })

  it('schema: limit runs 3 to 10 and the model sends no events', () => {
    expect(activityFeedSchema.safeParse(activityFeedSpec.example).success).toBe(true)
    expect(activityFeedSchema.safeParse({ limit: 11 }).success).toBe(false)
    expect(activityFeedSchema.safeParse({ items: [] }).success).toBe(false)
  })
})
