import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { STATES_BY_KIND, STATUS_KINDS, tagFor, type StatusListProps } from './schema'
import { StatusList } from './StatusList'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as StatusListProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof StatusList>[0]> = {}) =>
  render(
    <StatusList
      props={state === 'empty' ? (sample.empty as StatusListProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('StatusList', () => {
  it('default: the title, one row per item, the system tag words, sizes in words for screen readers', () => {
    const { container } = view('default')
    expect(screen.getByRole('heading', { name: 'Milestone pull requests' })).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(4)
    expect(screen.getByText('review pending')).toBeTruthy()
    expect(screen.getByText('changes requested')).toBeTruthy()
    expect(screen.getByText('412 lines added, 96 removed')).toBeTruthy()
  })

  it('skeleton: the frame is busy and rows are placeholders with no hairlines drawn from data', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
    expect(screen.getByText('Loading Milestone pull requests.')).toBeTruthy()
  })

  it('empty: one row with the model sentence, the system meta and the good mark it chose', () => {
    const { container } = view('empty')
    expect(screen.getByText('No open pull requests on v16.2')).toBeTruthy()
    expect(screen.getByText('last merged 2h ago · #84112')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('good')
  })

  it('error: the header stays, one row with the unavailable mark and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'Milestone pull requests' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar filling', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting reviews')).toBeTruthy()
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.38')
  })

  it('a row with a follow-up question is a button that asks it', () => {
    const onAsk = vi.fn()
    const items = props.items.map((item, i) => (i === 0 ? { ...item, ask: 'Why is #84120 waiting?' } : item))
    render(<StatusList props={{ ...props, items }} state="default" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button', { name: /Turbopack/ }))
    expect(onAsk).toHaveBeenCalledWith('Why is #84120 waiting?')
  })

  it('every state of every kind has system tag words', () => {
    for (const kind of STATUS_KINDS) for (const state of STATES_BY_KIND[kind]) expect(tagFor(kind, state)?.words).toBeTruthy()
  })
})
