import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionCard, CONFIRM_GUARD_MS } from './ActionCard'
import { effectWords, type ActionCardProps } from './schema'
import sample from './sample.json'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const props = sample.props as ActionCardProps

describe('ActionCard', () => {
  it('default (idle): heading, copy, primary, a secondary link to GitHub, and the sample line', () => {
    render(<ActionCard props={props} state="default" />)
    expect(screen.getByRole('region', { name: 'Nudge the three waiting reviewers' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nudge reviewers' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open milestone' }).getAttribute('href')).toContain('github.com')
    expect(screen.getByText(/would comment on #84120, #84077, #84201/)).toBeTruthy()
  })

  it('skeleton: busy with a hidden sentence and no buttons', () => {
    render(<ActionCard props={props} state="skeleton" />)
    expect(screen.getByText('Preparing a suggested action.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('error: the unavailable mark, what failed, the cause and Try again, never crit', () => {
    const { container } = render(<ActionCard props={props} state="error" error={sample.error} onRetry={() => undefined} />)
    expect(screen.getByText("Couldn't draft the comments")).toBeTruthy()
    expect(screen.getByText(/GitHub returned 502 on #84077/)).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('the primary never acts alone: it asks, focus moves to Confirm, and Confirm ignores its first 400ms', () => {
    vi.useFakeTimers()
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    render(<ActionCard props={props} state="default" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nudge reviewers' }))
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(document.activeElement).toBe(confirm)
    expect(screen.getByText(/Post 3 comments on/)).toBeTruthy()
    expect(screen.getByText(/drafts only, nothing is posted to GitHub/)).toBeTruthy()

    fireEvent.click(confirm)
    expect(screen.queryByRole('status')).toBeNull()

    now += CONFIRM_GUARD_MS + 1
    fireEvent.click(confirm)
    expect(screen.getByRole('status').textContent).toContain('Drafting comment 1 of 3')

    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(700)
      })
    }
    expect(screen.getByText('Drafted 3 comments')).toBeTruthy()
    expect(screen.getByText(/nothing was posted to GitHub/)).toBeTruthy()
  })

  it('Escape or Cancel returns to idle with focus on the primary', () => {
    vi.useFakeTimers()
    render(<ActionCard props={props} state="default" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nudge reviewers' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm' }), { key: 'Escape' })
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
    expect(document.activeElement?.textContent).toBe('Nudge reviewers')
  })

  it('writes every restatement from the effect, so it cannot drift', () => {
    expect(effectWords.question({ kind: 'rerun-checks', targets: ['e2e-turbopack'] })).toBe('Re-run the check e2e-turbopack?')
    expect(effectWords.done({ kind: 'request-review', targets: ['#1', '#2'] })).toBe('Drafted 2 review requests')
  })
})
