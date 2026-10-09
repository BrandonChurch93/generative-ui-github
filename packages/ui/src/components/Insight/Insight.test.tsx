import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { NUMBER_MISMATCH_SENTENCE } from '../../validate/numbers'
import { Insight } from './Insight'
import type { InsightProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as InsightProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Insight>[0]> = {}) =>
  render(
    <Insight
      props={state === 'empty' ? (sample.empty as InsightProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('Insight', () => {
  it('default: the sentence with identifiers in mono, the gradient rule and the source line', () => {
    const { container } = view('default')
    expect(container.querySelector('[data-sentence]')?.textContent).toBe(
      "Both failing checks are e2e-turbopack runs on canary, red since Tuesday's merge.",
    )
    expect(container.querySelectorAll('code')).toHaveLength(2)
    expect(container.querySelector('[data-source]')?.textContent).toBe('from 14 check runs on canary, 2 failing · last 7 days')
    expect(container.querySelector('[data-rule]')?.hasAttribute('data-quiet')).toBe(false)
  })

  it('skeleton: placeholder lines, busy, no rule', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-rule]')).toBeNull()
  })

  it('empty (nothing notable): a real sentence with its source and a muted rule', () => {
    const { container } = view('empty')
    expect(screen.getByText(/Nothing stands out on v16.2 this week/)).toBeTruthy()
    expect(container.querySelector('[data-rule]')?.hasAttribute('data-quiet')).toBe(true)
  })

  it('error: a plain sentence, the cause and Try again, a muted rule', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByText("Couldn't write an answer to this question.")).toBeTruthy()
    expect(container.querySelector('[data-rule]')?.hasAttribute('data-quiet')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: a muted sentence and the rule filling its track', () => {
    const { container } = view('warming')
    expect(container.querySelector('[data-sentence]')?.hasAttribute('data-quiet')).toBe(true)
    expect(container.querySelector('[data-rule]')?.getAttribute('style')).toContain('--progress: 0.35')
  })

  it('a source with a follow-up question is a chip that asks it', () => {
    const onAsk = vi.fn()
    render(<Insight props={props} state="default" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button', { name: '2 failing' }))
    expect(onAsk).toHaveBeenCalledWith('Which checks are failing?')
  })

  it('a figure its sources do not contain is never rendered; the system sentence takes its place', () => {
    const wrong = { ...props, sentence: 'Three failing checks are red on `canary`.' }
    const { container } = render(<Insight props={wrong} state="default" />)
    expect(container.querySelector('[data-sentence]')?.textContent).toBe(NUMBER_MISMATCH_SENTENCE)
    expect(container.textContent).not.toContain('Three failing')
  })
})
