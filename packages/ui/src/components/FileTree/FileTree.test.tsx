import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { FileTree } from './FileTree'
import { fileTreeSchema, fileTreeSpec, type FileTreeProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as FileTreeProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof FileTree>[0]> = {}) =>
  render(<FileTree props={state === 'empty' ? (sample.empty as FileTreeProps) : props} state={state} error={sample.error} {...extra} />)

const row = (name: RegExp | string) => screen.getByRole('button', { name })

describe('FileTree', () => {
  it('default: a nav named by the title, header file count and totals, collapsed folder sums, the selected file current', () => {
    const { container } = view('default')
    expect(screen.getByRole('navigation', { name: 'Files changed' })).toBeTruthy()
    expect(screen.getByText('9 files')).toBeTruthy()
    expect(screen.getByText(', 412 additions, 96 deletions')).toBeTruthy()
    const crates = screen.getByRole('button', { name: 'crates, 142 additions, 70 deletions' })
    expect(crates.getAttribute('aria-expanded')).toBe('false')
    const selected = screen.getByRole('link', { name: /get-css-inlined-link-tags\.tsx/ })
    expect(selected.getAttribute('aria-current')).toBe('true')
    expect(selected.getAttribute('tabindex')).toBe('0')
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-guide]')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'layout.tsx, 18 additions, 0 deletions. Open PR #84120 on GitHub' }).querySelector('[data-out]')).toBeTruthy()
  })

  it('skeleton: busy frame, placeholder rows, one sentence for screen readers', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-row]')).toHaveLength(0)
    expect(screen.getByText('Loading Files changed.')).toBeTruthy()
  })

  it('empty: the header keeps 0 files as data, one row says no files changed and why', () => {
    const { container } = view('empty')
    expect(screen.getByText('0 files')).toBeTruthy()
    expect(screen.getByText('No files changed')).toBeTruthy()
    expect(screen.getByText('head matches canary · #84211')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
  })

  it('error: the header and pull request stay, the unavailable mark, Try again', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'Files changed' })).toBeTruthy()
    expect(screen.getByText('#84120')).toBeTruthy()
    expect(screen.getByText("Couldn't load files")).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('a folder opens on click, its sums hand off to its files', () => {
    view('default')
    fireEvent.click(row('crates, 142 additions, 70 deletions'))
    expect(row('crates').getAttribute('aria-expanded')).toBe('true')
    expect(row('next-api/src, 24 additions, 9 deletions')).toBeTruthy()
  })

  it('arrow keys walk the rows and open and close folders; every row stays a real button or link', () => {
    view('default')
    const selected = screen.getByRole('link', { name: /get-css-inlined/ })
    selected.focus()
    fireEvent.keyDown(selected, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: /get-layer-assets/ }))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    const folder = row('packages/next/src/server/app-render')
    expect(document.activeElement).toBe(folder)
    expect(folder.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(folder, { key: 'ArrowLeft' })
    expect(folder.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(folder, { key: 'ArrowUp' })
    const crates = row(/^crates/)
    expect(document.activeElement).toBe(crates)
    fireEvent.keyDown(crates, { key: 'ArrowRight' })
    expect(crates.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(crates, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(row(/^next-api\/src/))
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: /css-order\.test\.ts/ }))
  })

  it('a file with a follow-up asks it through onAsk instead of following its link', () => {
    const onAsk = vi.fn()
    const files = props.files.map(f => (f.path.endsWith('get-layer-assets.tsx') ? { ...f, ask: 'Show the diff for get-layer-assets.tsx' } : f))
    render(<FileTree props={{ ...props, files }} state="default" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('link', { name: /get-layer-assets/ }))
    expect(onAsk).toHaveBeenCalledWith('Show the diff for get-layer-assets.tsx')
  })

  it('past 20 files only the selected path opens; past the cap the system says so', () => {
    const many = Array.from({ length: 3004 }, (_, i) => ({ path: `src/area-${i % 4}/file-${i}.ts`, additions: 1, deletions: 0 }))
    render(<FileTree props={{ ...props, files: many, total: 4212, open: undefined, selected: 'src/area-1/file-1.ts' }} state="default" />)
    expect(row(/^area-1/).getAttribute('aria-expanded')).toBe('true')
    expect(row(/^area-0/).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('4,212 files')).toBeTruthy()
    expect(screen.getByText('First 3,000 of 4,212 files · GitHub lists no more than 3,000')).toBeTruthy()
  })

  it('overview mode counts files on collapsed folders only', () => {
    const overview = sample.variants[0]!.props as FileTreeProps
    render(<FileTree props={overview} state="default" />)
    expect(screen.getByRole('button', { name: 'build, 4 files' })).toBeTruthy()
    expect(row('server').getAttribute('aria-expanded')).toBe('true')
  })

  it('schema: changes needs a pull request, overview takes a path; the example validates', () => {
    expect(fileTreeSchema.safeParse(fileTreeSpec.example).success).toBe(true)
    expect(fileTreeSchema.safeParse({ repo: 'vercel/next.js', mode: 'changes', title: 'Files' }).success).toBe(false)
    expect(fileTreeSchema.safeParse({ repo: 'vercel/next.js', mode: 'overview', path: 'packages/next/src', title: 'Source' }).success).toBe(true)
    expect(fileTreeSchema.safeParse({ repo: 'vercel/next.js', mode: 'overview', pr: 1, title: 'Source' }).success).toBe(false)
  })
})
