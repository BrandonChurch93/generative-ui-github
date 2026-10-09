import { describe, expect, it } from 'vitest'
import { bodyFor, FOLD_AT, foldHunks, parsePatch, wrapFor, type DiffLine } from './patch'
import sample from './sample.json'

const small = sample.props.patch
const big = sample.variants[0]!.props.patch!

const marked = (line: DiffLine) => (line.marks ?? []).map(([s, e]) => line.text.slice(s, e))

function longHunk(n: number): string {
  const body = Array.from({ length: n }, (_, i) => `+line ${i}`)
  return [`@@ -0,0 +1,${n} @@`, ...body].join('\n')
}

describe('parsePatch', () => {
  it('reads hunks verbatim with old and new line numbers and no sign column', () => {
    const hunks = parsePatch(small)
    expect(hunks.map(h => h.header)).toEqual([
      '@@ -13,6 +13,7 @@ export function getLinkAndScriptTags(',
      '@@ -21,7 +22,7 @@ export function getLinkAndScriptTags(',
    ])
    const [first, second] = hunks
    expect(first!.lines[0]).toMatchObject({ kind: 'context', old: 13, new: 13, text: '): { styles: string[]; scripts: string[] } {' })
    expect(first!.lines[3]).toMatchObject({ kind: 'add', new: 16, indent: 2 })
    expect(second!.lines[3]).toMatchObject({ kind: 'del', old: 24 })
    expect(second!.lines.at(-1)).toMatchObject({ old: 27, new: 28 })
  })

  it('ends a hunk on its header counts, so a trailing newline or a no-newline marker is never a line', () => {
    const hunks = parsePatch('@@ -1,2 +1,2 @@\n-a\n\\ No newline at end of file\n+b\n c\n')
    expect(hunks[0]!.lines.map(l => [l.kind, l.text])).toEqual([
      ['del', 'a'],
      ['add', 'b'],
      ['context', 'c'],
    ])
  })

  it('marks changed words on equal-length pairs, keeping a closing bracket with what it closes', () => {
    const [, second] = parsePatch(small)
    const [del, add] = second!.lines.filter(l => l.kind !== 'context')
    expect(marked(add!)).toEqual(['sortByChunkOrder(', ', cssOrder)'])
    expect(del!.marks).toBeUndefined()
  })

  it('leaves unequal runs and pairs that changed more than half a line to the tint', () => {
    const [first] = parsePatch(big)
    const lines = first!.lines
    // One removed line followed by two added: no pairing.
    expect(lines.slice(3, 6).every(l => !l.marks)).toBe(true)
    const pairs = lines.filter(l => l.kind !== 'context').slice(3)
    expect(pairs.map(marked)).toEqual([['copied'], [], ['cloned'], []])
  })

  it('keeps a line key across a push while its kind and text survive', () => {
    const before = parsePatch('@@ -1,2 +1,2 @@\n a\n-b\n+c\n')[0]!.lines.map(l => l.key)
    const after = parsePatch('@@ -1,2 +1,3 @@\n a\n+x\n-b\n+c\n')[0]!.lines.map(l => l.key)
    expect(after.filter(k => before.includes(k))).toHaveLength(3)
  })
})

describe('foldHunks', () => {
  it('shows everything up to the fold line', () => {
    const fold = foldHunks(parsePatch(small))
    expect(fold).toEqual({ shown: [7, 8], hiddenLines: 0, hiddenHunks: 0 })
  })

  it('past the fold, the lead hunk shows and the rest fold', () => {
    expect(foldHunks(parsePatch(big))).toEqual({ shown: [14, 0, 0], hiddenLines: 33, hiddenHunks: 2 })
  })

  it('cuts a lead hunk that is itself past the fold', () => {
    expect(foldHunks(parsePatch(longHunk(100)))).toEqual({ shown: [FOLD_AT], hiddenLines: 60, hiddenHunks: 1 })
  })
})

describe('wrapFor and bodyFor', () => {
  it('scrolls indentation-significant files and wraps the rest', () => {
    expect(['ci.yml', 'a/b.yaml', 'setup.py', 'Makefile', 'rules.mk'].map(wrapFor)).toEqual(Array(5).fill('scroll'))
    expect(['app.tsx', 'lib.rs', 'README'].map(wrapFor)).toEqual(['wrap', 'wrap', 'wrap'])
  })

  it('stops at the limit, summarizes what GitHub omits, and keeps a rename as empty', () => {
    const file = (additions: number, deletions: number, status = 'modified', patch?: string) => ({ additions, deletions, status, patch })
    expect(bodyFor(file(800, 201, 'modified', small), parsePatch(small))).toBe('limit')
    expect(bodyFor(file(2, 1, 'modified', small), parsePatch(small))).toBe('lines')
    expect(bodyFor(file(40, 0), [])).toBe('omitted')
    expect(bodyFor(file(0, 0), [])).toBe('binary')
    expect(bodyFor(file(0, 0, 'renamed'), [])).toBe('empty')
  })
})
