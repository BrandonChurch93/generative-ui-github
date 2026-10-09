import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { DiffView } from './DiffView'
import { diffViewSchema, diffViewSpec, type DiffViewProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as DiffViewProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as DiffViewProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof DiffView>[0]> = {}) =>
  render(<DiffView props={state === 'empty' ? (sample.empty as DiffViewProps) : props} state={state} error={sample.error} {...extra} />)

describe('DiffView', () => {
  it('default: the path, the counts in words, one tbody per hunk, signs in words, word highlights as mark', () => {
    const { container } = view('default')
    expect(screen.getByRole('button', { name: 'packages/next/src/server/app-render/get-css-inlined-link-tags.tsx' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('2 additions, 1 deletion')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Changes to get-css-inlined-link-tags.tsx' })).toBeTruthy()
    expect(container.querySelectorAll('[data-hunk]')).toHaveLength(2)
    expect(screen.getByText('@@ -21,7 +22,7 @@ export function getLinkAndScriptTags(')).toBeTruthy()
    const added = container.querySelector('[data-kind="add"]')!
    expect(added.querySelector('[data-s]')?.getAttribute('data-s')).toBe('+')
    expect(added.textContent).toContain('added')
    expect([...container.querySelectorAll('mark')].map(m => m.textContent)).toEqual(['sortByChunkOrder(', ', cssOrder)'])
    expect(container.querySelector('[data-fold]')).toBeNull()
  })

  it('skeleton: busy, one sentence for screen readers, no lines, no counts', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText('Loading the diff for get-css-inlined-link-tags.tsx.')).toBeTruthy()
    expect(container.querySelector('[data-row]')).toBeNull()
    expect(container.querySelector('[data-count]')).toBeNull()
  })

  it('empty: a rename keeps +0 and −0 as data and says what the file was', () => {
    const { container } = view('empty')
    expect(screen.getByText('Renamed without changes')).toBeTruthy()
    expect(screen.getByText('was next.config.mjs · 14 lines, identical')).toBeTruthy()
    expect(container.querySelector('[data-count="add"]')?.textContent).toBe('+0')
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
  })

  it('error: the header keeps the path, the unavailable mark, never crit, and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByText('get-css-inlined-link-tags.tsx')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText('GitHub returned 502 · tried twice')).toBeTruthy()
    expect(container.querySelector('[data-count]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('folds and opens from the header toggle', async () => {
    const { container } = view('default')
    const toggle = screen.getByRole('button', { expanded: true })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => expect(container.querySelector('[data-body]')).toBeNull())
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-body]')).toBeTruthy()
  })

  it('open false renders the header alone', () => {
    const { container } = render(<DiffView props={variant('Folded')} state="default" />)
    expect(screen.getByRole('button', { expanded: false })).toBeTruthy()
    expect(screen.getByText('+23')).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
  })

  it('past 40 lines the rest folds; Show all reveals it and moves focus to the first revealed hunk', () => {
    const { container } = render(<DiffView props={variant('Large diff, folded after the first hunk')} state="default" />)
    expect(container.querySelectorAll('[data-hunk]')).toHaveLength(1)
    expect(screen.getByText('33 more lines hidden in 2 hunks')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(container.querySelectorAll('[data-hunk]')).toHaveLength(3)
    expect(container.querySelector('[data-fold]')).toBeNull()
    expect(document.activeElement?.textContent).toBe('@@ -140,9 +141,14 @@ pub async fn get_app_client_references_chunks(')
  })

  it('over the limit, a summary replaces the lines and the header keeps the real counts', () => {
    render(<DiffView props={variant('Over the limit')} state="default" />)
    expect(screen.getByText('Too large to show here')).toBeTruthy()
    expect(screen.getByText('2,354 changed lines · the limit is 1,000')).toBeTruthy()
    expect(screen.getByText('+1,206')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View on GitHub' }).getAttribute('href')).toBe('https://github.com/vercel/next.js/pull/71904/files')
  })

  it('indentation-significant files scroll in a focusable region instead of wrapping', () => {
    render(<DiffView props={variant('Indentation-significant, scrolls')} state="default" />)
    expect(screen.getByRole('region', { name: 'build_and_test.yml, scrolls sideways' }).getAttribute('data-wrap')).toBe('scroll')
  })
})

describe('diffViewSchema', () => {
  it('takes the example and holds lead back', () => {
    expect(diffViewSchema.safeParse(diffViewSpec.example).success).toBe(true)
    expect(diffViewSchema.safeParse({ ...diffViewSpec.example, lead: 1 }).success).toBe(false)
    expect(diffViewSchema.safeParse({ ...diffViewSpec.example, pr: 0 }).success).toBe(false)
  })
})
