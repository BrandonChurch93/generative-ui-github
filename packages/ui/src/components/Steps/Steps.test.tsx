import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { splitFact } from './fact'
import { stepsSchema, stepsSpec, type StepsProps } from './schema'
import { Steps } from './Steps'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as StepsProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof Steps>[0]> = {}) =>
  render(<Steps props={props} state={state} error={sample.error} warming={sample.warming} {...extra} />)

describe('Steps', () => {
  it('default: an ordered list of h3 steps, each heading saying where it sits, one segment between each pair', () => {
    const { container } = view('default')
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
    expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual([
      'Step 1 of 4. Read the contributing guide',
      'Step 2 of 4. Pick a good first issue',
      'Step 3 of 4. Run the tests locally',
      'Step 4 of 4. Ask in Discussions',
    ])
    expect(container.querySelectorAll('[data-spine]')).toHaveLength(3)
    expect(container.querySelector('[data-row="discussions"] [data-spine]')).toBeNull()
    expect(container.querySelectorAll('[data-first]')).toHaveLength(1)
    expect(container.querySelector('[data-row="contributing-guide"]')?.hasAttribute('data-first')).toBe(true)
    expect(container.querySelector('[data-ring]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('backticks in a body set as code', () => {
    const code = sample.variants[0]!.props as StepsProps
    const { container } = render(<Steps props={code} state="default" />)
    expect([...container.querySelectorAll('code')].map(c => c.textContent)).toContain('corepack enable')
  })

  it('skeleton: busy, placeholder steps, no spine and no accent ring', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText('Writing the steps.')).toBeTruthy()
    expect(container.querySelector('[data-spine]')).toBeNull()
    expect(container.querySelector('[data-first]')).toBeNull()
  })

  it('empty is omitted: the composer writes an Insight below two steps', () => {
    expect(stepsSpec.statesOmitted?.map(s => s.state)).toEqual(['empty'])
    expect(stepsSchema.safeParse({ title: 'Where to start', steps: props.steps.slice(0, 1) }).success).toBe(false)
  })

  it('error: the header stays, the unavailable mark and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { level: 2, name: 'Where to start' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar filling', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting recent contributors')).toBeTruthy()
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.38')
  })

  it('an ask link stays in the app and asks its question', () => {
    const onAsk = vi.fn()
    view('default', { onAsk })
    fireEvent.click(screen.getByRole('button', { name: 'Show the 12 issues' }))
    expect(onAsk).toHaveBeenCalledWith('Show the good first issues')
  })

  it('an href link leaves the app and says where it goes', () => {
    view('default')
    const out = screen.getByRole('link', { name: 'Contributing guide (opens GitHub)' })
    expect(out.getAttribute('target')).toBe('_blank')
    cleanup()
    render(<Steps props={sample.variants[1]!.props as StepsProps} state="default" />)
    expect(screen.getByRole('link', { name: 'Contributor agreement (opens in a new tab)' })).toBeTruthy()
  })

  it('every sample validates, and a link label over 28 characters does not', () => {
    for (const p of [props, ...sample.variants.map(v => v.props)]) expect(stepsSchema.safeParse(p).success).toBe(true)
    const long = { ...props.steps[0]!, link: { label: 'Read the whole contributing guide', href: 'https://github.com' } }
    expect(stepsSchema.safeParse({ ...props, steps: [long, props.steps[1]] }).success).toBe(false)
  })

  it('counts whole numbers in a fact, never versions', () => {
    expect(splitFact('2,140 suites')).toEqual({ before: '', value: 2140, after: ' suites' })
    expect(splitFact('median reply 5h').value).toBe(5)
    expect(splitFact('pnpm 9.15').value).toBeUndefined()
  })
})
