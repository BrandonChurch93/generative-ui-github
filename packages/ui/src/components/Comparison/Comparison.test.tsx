import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { Comparison } from './Comparison'
import { comparisonLabel, deltaFor, deltaWords, tally, verdictFor } from './reading'
import { comparisonSchema, comparisonSpec, type ComparisonPair, type ComparisonProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as ComparisonProps
const asking = sample.variants[0]!.props as ComparisonProps
const neutral = sample.variants[1]!.props as ComparisonProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Comparison>[0]> = {}) =>
  render(
    <Comparison
      props={state === 'empty' ? (sample.empty as ComparisonProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

const pair = (over: Partial<ComparisonPair>): ComparisonPair => ({
  measure: 'review-wait-median',
  direction: 'lower-is-better',
  notable: true,
  name: 'Median review wait',
  unit: 'h',
  current: 10,
  previous: 10,
  ...over,
})

describe('Comparison', () => {
  it('default: a figure labeled by the finding, the legend, signed deltas with system verdicts and the tally', () => {
    const { container } = view('default')
    expect(screen.getByRole('figure', { name: props.finding })).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(4)
    expect([...container.querySelectorAll('[data-delta]')].map(d => d.parentElement?.textContent)).toEqual(['+38%', '+15%', '−3%', '−2.2pts'])
    expect([...container.querySelectorAll('[data-verdict-word]')].map(v => v.textContent)).toEqual(['worse', 'better', 'steady', 'better'])
    expect(container.querySelector('[data-tally]')?.textContent).toBe('2 better · 1 worse · 1 steady')
    expect(screen.getByText('from 214 merged PRs · 3,480 check runs')).toBeTruthy()
    expect(screen.getByText('19.6 hours in September, 14.2 in August.')).toBeTruthy()
    expect(container.querySelector('table[data-table-view]')?.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('skeleton: busy, one row per requested pair, no hairlines, no values', () => {
    const { container } = view('skeleton', { props: asking })
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('[data-hairline]')).toBeNull()
    expect(container.querySelector('[data-value]')).toBeNull()
    expect(screen.getByText('Loading the comparison.')).toBeTruthy()
  })

  it('empty: the window in the header and one row with the system message', () => {
    const { container } = view('empty')
    expect(screen.getByText('September vs August')).toBeTruthy()
    expect(screen.getByText('No docs PRs were reviewed in either month')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
  })

  it('error: card level, the unavailable mark, never crit, and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByText("Couldn't load check runs")).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(container.querySelector('[data-row]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting commits for both months')).toBeTruthy()
    expect(container.querySelector('[data-progress]')).toBeTruthy()
  })

  it('a pair with an ask is a button that reads the whole row, asks on click and opens the tooltip on focus', () => {
    const onAsk = vi.fn()
    const { container } = render(<Comparison props={asking} state="default" onAsk={onAsk} />)
    const row = screen.getByRole('button', { name: 'Median review wait, 19.6 hours in September, up 38% from 14.2 in August, worse' })
    fireEvent.focus(row)
    expect(container.querySelector('[data-tooltip]')?.textContent).toBe('19.6hSep+5.4h14.2hAugworse')
    fireEvent.click(row)
    expect(onAsk).toHaveBeenCalledWith(asking.pairs[0]!.ask)
  })

  it('verdicts are the system words: neutral reads higher, an exact zero reads 0% and no change', () => {
    const { container } = render(<Comparison props={neutral} state="default" />)
    expect([...container.querySelectorAll('[data-verdict-word]')].map(v => v.textContent)).toEqual(['worse', 'higher', 'no change'])
    expect(container.querySelectorAll('[data-delta]')[2]?.parentElement?.textContent).toBe('0%')
    expect(tally(neutral.pairs)).toBe('1 worse · 1 higher · 1 no change')
    expect(verdictFor(pair({ current: 8, notable: false }))).toBe('steady')
    expect(verdictFor(pair({ current: 8 }))).toBe('better')
  })

  it('deltas: one decimal under 1%, points for rates, the unit when there is no previous value', () => {
    expect(deltaWords(deltaFor(pair({ current: 100.5, previous: 100 })))).toBe('+0.5%')
    expect(deltaWords(deltaFor(pair({ unit: 'percent', current: 6.3, previous: 4.1 })))).toBe('+2.2 pts')
    expect(deltaWords(deltaFor(pair({ unit: 'count', current: 3, previous: 0 })))).toBe('+3')
  })

  it('a finding whose numbers do not match the values never becomes the label', () => {
    expect(comparisonLabel({ ...props, finding: 'Review wait rose 52% in September' })).toBe(
      'Review and CI health, September against August: 2 better, 1 worse, 1 steady.',
    )
  })

  it('schema: the example validates; one pair, a clock measure and a model-written verdict do not', () => {
    expect(comparisonSchema.safeParse(comparisonSpec.example).success).toBe(true)
    const base = comparisonSpec.example!
    expect(comparisonSchema.safeParse({ ...base, pairs: base.pairs.slice(0, 1) }).success).toBe(false)
    expect(comparisonSchema.safeParse({ ...base, pairs: [base.pairs[0], { measure: 'busiest-hour', direction: 'neutral' }] }).success).toBe(false)
    expect(comparisonSchema.safeParse({ ...base, pairs: [{ ...base.pairs[0], verdict: 'better' }, base.pairs[1]] }).success).toBe(false)
  })
})
