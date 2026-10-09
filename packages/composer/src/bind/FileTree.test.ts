// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import { bindFileTree } from './FileTree'
import { check, nextContext } from './testing'

afterEach(cleanup)

describe('bindFileTree', () => {
  it('binds the biggest open pull request files with its totals and selects the largest file outside the lockfile', async () => {
    const ctx = await nextContext()
    const piece = bindFileTree(ctx, { repo: 'vercel/next.js', mode: 'changes', pr: 99178, title: 'Files changed' })
    const { node, warnings } = check(piece)
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    const props = node.props as { files: { path: string }[]; totals: { additions: number; deletions: number }; total?: number; selected: string }
    expect(props.files).toHaveLength(28)
    expect(props.totals).toEqual({ additions: 2321, deletions: 133 })
    expect(props.total).toBeUndefined()
    expect(props.selected).toBe('test/unit/eval-browser-js/sdk-lifecycle.cjs')

    const { container } = render(createElement(PIECES.FileTree!.Component, { props: node.props, state: node.state }))
    expect(container.textContent).toContain('sdk-lifecycle.cjs')
  })

  it('binds the files changed between the last two releases in overview mode', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindFileTree({ ...ctx, scope: { release: true } }, { repo: 'vercel/next.js', mode: 'overview', title: 'Changed areas' }))
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    expect((node.props as { files: unknown[] }).files).toHaveLength(25)
  })

  it('is unavailable for a pull request whose files were not read', async () => {
    const ctx = await nextContext()
    const { node } = check(bindFileTree(ctx, { repo: 'vercel/next.js', mode: 'changes', pr: 1, title: 'Files changed' }))
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't load files", cause: "Not in this answer's data" })
  })
})
