// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import { bindCodeBlock } from './CodeBlock'
import { check, nextContext } from './testing'

afterEach(cleanup)

describe('bindCodeBlock', () => {
  it('binds lines of the README, the one file the context holds, at the commit it was read at', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindCodeBlock(ctx, { repo: 'vercel/next.js', path: 'README.md', lines: [8, 11] }))
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    const props = node.props as { path: string; text: string; start: number; ref: string }
    expect(props.path).toBe('readme.md')
    expect(props.text.split('\n')).toHaveLength(4)
    expect(props.text).toContain('<h1>Next.js</h1>')
    expect(props.start).toBe(8)
    expect(props.ref).toBe(ctx.repo.sha)

    const { container } = render(createElement(PIECES.CodeBlock!.Component, { props: node.props, state: node.state }))
    expect(container.textContent).toContain('Next.js')
  })

  it('is unavailable for any other file, and empty past the end of the README', async () => {
    const ctx = await nextContext()
    const other = check(bindCodeBlock(ctx, { repo: 'vercel/next.js', path: 'packages/next/src/server/base-server.ts' }))
    expect(other.node.state).toBe('error')
    expect(other.node.error).toEqual({ failed: "Couldn't load base-server.ts", cause: "This file is not in this answer's data" })

    expect(check(bindCodeBlock(ctx, { repo: 'vercel/next.js', path: 'README.md', lines: [5000, 5010] })).node.state).toBe('empty')
  })
})
