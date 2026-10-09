import { z } from 'zod'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { KeyValue } from './KeyValue'
import { keyValueSchema, keyValueSpec, type KeyValueProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as KeyValueProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof KeyValue>[0]> = {}) =>
  render(<KeyValue props={state === 'empty' ? (sample.empty as KeyValueProps) : props} state={state} error={sample.error} {...extra} />)

describe('KeyValue', () => {
  it('default: a description list of labeled facts, counts and times formatted by the system, identifiers marked', () => {
    const { container } = view('default')
    expect(screen.getByRole('heading', { name: 'vercel/next.js' })).toBeTruthy()
    expect(container.querySelectorAll('dt')).toHaveLength(7)
    expect(screen.getByText('134,812')).toBeTruthy()
    expect(screen.getByText('2h ago').getAttribute('datetime')).toBe('2026-10-04T16:00:00Z')
    expect(container.querySelector('[data-row="default-branch"] [data-value]')?.getAttribute('data-kind')).toBe('identifier')
  })

  it('a zero is data, and no more than eight pairs render', () => {
    const pr = sample.variants[0]!.props as KeyValueProps
    const { container } = render(<KeyValue props={pr} state="default" />)
    expect(container.querySelector('[data-row="reviews"] [data-value]')?.textContent).toBe('0')
    cleanup()
    const many = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, label: `Fact ${i}`, value: i, kind: 'count' as const }))
    const { container: capped } = render(<KeyValue props={{ ...props, pairs: many }} state="default" />)
    expect(capped.querySelectorAll('[data-row]')).toHaveLength(8)
  })

  it('skeleton: busy frame, placeholder pairs, a hidden loading sentence', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
    expect(screen.getByText('Loading repository facts.')).toBeTruthy()
  })

  it('empty: the header stays, one row with the system sentence and its meta', () => {
    view('empty')
    expect(screen.getByRole('heading', { name: 'About this release' })).toBeTruthy()
    expect(screen.getByText('No releases published yet')).toBeTruthy()
    expect(screen.getByText('14 tags · latest tag v0.3.0-rc.1')).toBeTruthy()
  })

  it('error: the header stays, the unavailable mark, the cause and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'vercel/next.js' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: omitted with a reason; a stray warming state waits as a skeleton, never a 202 row', () => {
    expect(keyValueSpec.statesOmitted?.map(s => s.state)).toEqual(['warming'])
    const { container } = view('warming')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-state="warming"]')).toBeNull()
  })

  it('a card with a follow-up question is one button that asks it', () => {
    const onAsk = vi.fn()
    const { container } = view('default', { ask: 'How active is vercel/next.js?', onAsk })
    expect(container.querySelector('dl')).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    expect(onAsk).toHaveBeenCalledWith('How active is vercel/next.js?')
  })

  it('schema: a pr source must name its pull request, and the model sends no pairs', () => {
    expect(keyValueSchema.safeParse(keyValueSpec.example).success).toBe(true)
    expect(keyValueSchema.safeParse({ source: 'repo' }).success).toBe(true)
    expect(keyValueSchema.safeParse({ source: 'pr' }).success).toBe(false)
    expect(keyValueSchema.safeParse({ source: 'repo', pairs: [] }).success).toBe(false)
    expect(() => z.toJSONSchema(keyValueSchema, { unrepresentable: 'any' })).not.toThrow()
  })
})
