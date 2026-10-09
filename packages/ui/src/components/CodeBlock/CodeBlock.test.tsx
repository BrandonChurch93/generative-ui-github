import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { CodeBlock } from './CodeBlock'
import { splitLines } from './code'
import { codeBlockSchema, codeBlockSpec, CODE_WORDS, FOLD_AT, type CodeBlockProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as CodeBlockProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as CodeBlockProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof CodeBlock>[0]> = {}) =>
  render(<CodeBlock props={state === 'empty' ? (sample.empty as CodeBlockProps) : props} state={state} error={sample.error} {...extra} />)

describe('CodeBlock', () => {
  it('default: the path as a mono header, the range, numbered lines, the caption and the link at those lines', () => {
    const { container } = view('default')
    expect(screen.getByRole('heading', { name: 'packages/next/src/server/app-render/get-css-inlined-link-tags.tsx' })).toBeTruthy()
    expect(screen.getByText('lines 6 to 32')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'get-css-inlined-link-tags.tsx, lines 6 to 32' })).toBeTruthy()
    const rows = container.querySelectorAll('[data-row]')
    expect(rows).toHaveLength(27)
    expect(rows[0]!.querySelector('[data-n]')?.getAttribute('data-n')).toBe('6')
    expect(rows[0]!.textContent).toBe('export function getLinkAndScriptTags(')
    expect(screen.getByText(props.caption!)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View on GitHub' }).getAttribute('href')).toBe(
      'https://github.com/vercel/next.js/blob/a3f9c1e/packages/next/src/server/app-render/get-css-inlined-link-tags.tsx#L6-L32',
    )
    expect(container.querySelector('[data-lines]')?.getAttribute('data-wrap')).toBe('wrap')
  })

  it('skeleton: the frame, busy, one sentence for screen readers, no lines', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByText('Loading get-css-inlined-link-tags.tsx.')).toBeTruthy()
    expect(container.querySelector('[data-row]')).toBeNull()
  })

  it('empty: the header keeps the path; a neutral row says the range is past the end and how long the file is', () => {
    const { container } = view('empty')
    expect(screen.getByText('get-css-inlined-link-tags.tsx')).toBeTruthy()
    expect(screen.getByText('Lines 80 to 96 are past the end of the file')).toBeTruthy()
    expect(screen.getByText('the file has 58 lines')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
  })

  it('error: the header keeps the path, the unavailable mark, never crit, and Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByText('get-css-inlined-link-tags.tsx')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText('GitHub returned 404 · the file is not on canary')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming cannot happen, and says why', () => {
    expect(codeBlockSpec.statesOmitted?.map(s => s.state)).toEqual(['warming'])
  })

  it(`folds past ${FOLD_AT} lines; Show all reveals the rest and moves focus to the first revealed line`, () => {
    const long = variant('Long, folded at 40 lines')
    const { container } = render(<CodeBlock props={long} state="default" />)
    expect(container.querySelectorAll('[data-row]')).toHaveLength(FOLD_AT)
    expect(screen.getByText(CODE_WORDS.hidden(25))).toBeTruthy()
    expect(screen.getByText('65 lines')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(container.querySelectorAll('[data-row]')).toHaveLength(65)
    expect(container.querySelector('[data-fold]')).toBeNull()
    expect(document.activeElement?.querySelector('[data-n]')?.getAttribute('data-n')).toBe('41')
  })

  it('indentation-significant files scroll sideways in a focusable region instead of wrapping', () => {
    render(<CodeBlock props={variant('Indentation-significant, scrolls sideways')} state="default" />)
    const region = screen.getByRole('region', { name: 'build_and_test.yml, scrolls sideways' })
    expect(region.getAttribute('data-wrap')).toBe('scroll')
    expect(region.tabIndex).toBe(0)
  })

  it('a final newline ends the last line; it does not add a blank one', () => {
    expect(splitLines('a\n  b\n', 10).map(l => [l.n, l.indent])).toEqual([
      [10, 0],
      [11, 2],
    ])
  })

  it('the schema takes a range that runs forward and nothing the system supplies', () => {
    expect(codeBlockSchema.safeParse(codeBlockSpec.example).success).toBe(true)
    expect(codeBlockSchema.safeParse({ repo: 'vercel/next.js', path: 'a.ts', lines: [30, 6] }).success).toBe(false)
    expect(codeBlockSchema.safeParse({ repo: 'vercel/next.js', path: 'a.ts', text: 'x' }).success).toBe(false)
  })
})
