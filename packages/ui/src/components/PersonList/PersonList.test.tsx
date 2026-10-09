import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { factWords, PersonList } from './PersonList'
import { PERSON_MEASURES, PERSON_WORDS, personListSchema, type PersonListProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as PersonListProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof PersonList>[0]> = {}) =>
  render(
    <PersonList
      props={state === 'empty' ? (sample.empty as PersonListProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('PersonList', () => {
  it('default: up to the limit, ranked, each person read as handle, name and the one fact', () => {
    const { container } = view('default')
    expect(screen.getByRole('heading', { name: 'Most commits' })).toBeTruthy()
    expect(container.querySelector('ol')).toBeTruthy()
    expect([...container.querySelectorAll('[data-row]')].map(r => r.getAttribute('data-row'))).toEqual(['mira-dev', 'tkato', 'j-oduya', 'lenaw', 'pdubois'])
    expect(screen.getByText('mira-dev, Mira Devlin, 268 commits')).toBeTruthy()
    expect(screen.getByText('pdubois, 61 commits')).toBeTruthy()
    expect(screen.getByRole('link', { name: /tkato/ }).getAttribute('href')).toBe('https://github.com/tkato')
  })

  it('skeleton: busy frame, placeholder rows, a hidden loading sentence', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
    expect(screen.getByText('Loading commit authors.')).toBeTruthy()
  })

  it('empty: the header stays, one row with the system sentence and its meta', () => {
    view('empty')
    expect(screen.getByRole('heading', { name: 'Most issues opened' })).toBeTruthy()
    expect(screen.getByText('Nobody opened an issue in the last 7 days')).toBeTruthy()
    expect(screen.getByText('last issue opened 9d ago · #84201')).toBeTruthy()
  })

  it('error: the header stays, the unavailable mark, the cause and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'Most commits' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar filling', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting contributors')).toBeTruthy()
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.38')
  })

  it('a row with a follow-up question is a button that asks it; one is singular', () => {
    const onAsk = vi.fn()
    render(<PersonList props={sample.variants[0]!.props as PersonListProps} state="default" onAsk={onAsk} />)
    expect(screen.getByText('ivanko, 1 review')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /hgrey/ }))
    expect(onAsk).toHaveBeenCalledWith('What is hgrey reviewing?')
  })

  it('system words exist for every measure and the model cannot send people', () => {
    for (const m of PERSON_MEASURES) expect(factWords(2, m)).toBe(`2 ${PERSON_WORDS[m].many}`)
    expect(personListSchema.safeParse({ measure: 'reviews', limit: 9 }).success).toBe(false)
    expect(personListSchema.safeParse({ measure: 'commits', people: [] }).success).toBe(false)
  })
})
