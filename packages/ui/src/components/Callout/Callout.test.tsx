import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { Callout } from './Callout'
import { CALLOUT_WORDS, calloutSchema, calloutSpec, type CalloutProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as CalloutProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as CalloutProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Callout>[0]> = {}) =>
  render(<Callout props={props} state={state} error={sample.error} {...extra} />)

describe('Callout', () => {
  it('default: the sentence with identifiers in mono, the tone in mark, rule and words, and the meta line', () => {
    const { container } = view('default')
    expect(screen.getByRole('note').textContent).toContain(
      'Worth a look. e2e-turbopack has failed on canary 6 runs in a row, so nothing merged since Tuesday can ship yet.',
    )
    expect(container.querySelectorAll('code')).toHaveLength(2)
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('warn')
    expect(container.querySelector('[data-rule]')?.getAttribute('data-tone')).toBe('warn')
    expect(screen.getByText('from failing-since · canary · last 7 days')).toBeTruthy()
  })

  it('skeleton: the frame, busy, one sentence for screen readers, no rule', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText(CALLOUT_WORDS.loading)).toBeTruthy()
    expect(container.querySelector('[data-rule]')).toBeNull()
  })

  it('error: the unavailable mark and a muted rule, never crit, the cause and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByText("Couldn't show this note")).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(container.querySelector('[data-rule]')?.getAttribute('data-tone')).toBe('quiet')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('empty and warming cannot happen, and say why', () => {
    expect(calloutSpec.statesOmitted?.map(s => s.state)).toEqual(['empty', 'warming'])
  })

  it('a figure the data does not hold is never rendered; the system sentence takes its place, neutral', () => {
    const { container } = render(<Callout props={variant('A figure the data does not hold')} state="default" />)
    expect(container.textContent).not.toContain('9 runs')
    expect(screen.getByText(CALLOUT_WORDS.mismatch)).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
  })

  it('with no figures bound, the sentence may cite none', () => {
    const { numbers: _numbers, ...unbound } = props
    render(<Callout props={unbound} state="default" />)
    expect(screen.getByText(CALLOUT_WORDS.mismatch)).toBeTruthy()
  })

  it('a piece with a follow-up question is one button that asks it', () => {
    const onAsk = vi.fn()
    view('default', { ask: 'Why is e2e-turbopack failing?', onAsk })
    fireEvent.click(screen.getByRole('button'))
    expect(onAsk).toHaveBeenCalledWith('Why is e2e-turbopack failing?')
  })

  it('the schema takes a tone and at most 160 characters, nothing else', () => {
    expect(calloutSchema.safeParse(calloutSpec.example).success).toBe(true)
    expect(calloutSchema.safeParse({ tone: 'warn', text: 'x'.repeat(161) }).success).toBe(false)
    expect(calloutSchema.safeParse({ tone: 'warn', text: 'Fine.', color: 'red' }).success).toBe(false)
  })
})
