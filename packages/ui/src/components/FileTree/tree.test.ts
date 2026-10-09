import { describe, expect, it } from 'vitest'
import {
  buildTree,
  capFiles,
  countWidths,
  defaultOpen,
  FILE_CAP,
  folders,
  middleTruncate,
  visibleRows,
  type FileEntry,
  type TreeFolder,
} from './tree'
import sample from './sample.json'

const files = sample.props.files as FileEntry[]
const shown = (t: { head: string; tail: string } | null) => (t ? `${t.head}…${t.tail}` : null)

describe('buildTree', () => {
  it('orders folders first then files, compresses single-folder chains and rolls counts up', () => {
    const tree = buildTree(files)
    expect(tree.map(n => n.name)).toEqual(['crates', 'packages/next/src/server/app-render', 'test/e2e/app-dir/css-order'])
    const crates = tree[0] as TreeFolder
    expect(crates.children.map(n => n.name)).toEqual(['next-api/src', 'next-core/src/next_app'])
    expect([crates.additions, crates.deletions, crates.files]).toEqual([142, 70, 2])
    const css = tree[2] as TreeFolder
    expect(css.children.map(n => `${n.kind}:${n.name}:${n.depth}`)).toEqual(['folder:app/nested:1', 'file:css-order.test.ts:1'])
  })

  it('keeps a file that sits beside a folder from compressing the chain', () => {
    const tree = buildTree([{ path: 'a/b/c.ts' }, { path: 'a/d.ts' }])
    expect(tree.map(n => n.name)).toEqual(['a'])
    expect((tree[0] as TreeFolder).children.map(n => n.name)).toEqual(['b', 'd.ts'])
  })
})

describe('defaultOpen', () => {
  const tree = buildTree(files)
  const all = folders(tree).map(f => f.path)

  it('opens every folder at 20 files or fewer', () => {
    expect([...defaultOpen(tree, { fileCount: 9 })].sort()).toEqual([...all].sort())
  })

  it('past 20 files opens only the selected file path', () => {
    const open = defaultOpen(tree, { fileCount: 21, selected: 'crates/next-api/src/app.rs' })
    expect([...open]).toEqual(['crates', 'crates/next-api/src'])
  })

  it('a folder the model names opens its row, including one inside a compressed chain', () => {
    const open = defaultOpen(tree, { fileCount: 9, open: ['test/e2e', 'crates/next-core'] })
    expect([...open].sort()).toEqual(['crates', 'crates/next-core/src/next_app', 'test/e2e/app-dir/css-order'])
  })

  it('past 20 files with nothing selected opens a lone top folder', () => {
    const lone = buildTree(Array.from({ length: 25 }, (_, i) => ({ path: `src/lib/f${i}.ts` })))
    expect([...defaultOpen(lone, { fileCount: 25 })]).toEqual(['src/lib'])
  })

  it('walks only the rows a reader can reach', () => {
    const open = new Set(['crates'])
    expect(visibleRows(tree, p => open.has(p)).map(r => r.node.name)).toEqual([
      'crates',
      'next-api/src',
      'next-core/src/next_app',
      'packages/next/src/server/app-render',
      'test/e2e/app-dir/css-order',
    ])
  })
})

describe('middleTruncate', () => {
  it('drops the word nearest the center and keeps the first word and the extension with the word before it', () => {
    expect(shown(middleTruncate('get-css-inlined-link-tags.tsx', 24, 'file'))).toBe('get-css-…-link-tags.tsx')
    expect(shown(middleTruncate('app_client_references_chunks.rs', 24, 'file'))).toBe('app_client_…_chunks.rs')
  })

  it('keeps a folder chain first and last segment', () => {
    expect(shown(middleTruncate('packages/next/src/server/app-render', 34, 'folder'))).toBe('packages/next/…/server/app-render')
    expect(shown(middleTruncate('packages/next/src/server/app-render', 20, 'folder'))).toBe('packages/…/app-render')
  })

  it('never cuts mid-word, and returns null when the name fits or has no words to drop', () => {
    expect(middleTruncate('page.tsx', 40, 'file')).toBeNull()
    expect(middleTruncate('averyveryverylongfilename.ts', 10, 'file')).toBeNull()
    expect(shown(middleTruncate('a-b-c-d-e-f.ts', 3, 'file'))).toBe('a-…-f.ts')
  })
})

describe('caps and columns', () => {
  it('caps at 3,000 files and says it did', () => {
    const many = Array.from({ length: FILE_CAP + 5 }, (_, i) => ({ path: `f${i}.ts` }))
    const capped = capFiles(many)
    expect(capped.files).toHaveLength(FILE_CAP)
    expect(capped.truncated).toBe(true)
  })

  it('sizes the count columns to the widest value in the tree, folder sums and totals included', () => {
    expect(countWidths(buildTree(files))).toEqual({ add: 4, del: 3, files: 1 })
    expect(countWidths(buildTree(files), { additions: 1204, deletions: 96 }).add).toBe(6)
  })
})
