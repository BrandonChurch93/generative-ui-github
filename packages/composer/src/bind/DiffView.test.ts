// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PIECES } from '@genui-github/ui/pieces'
import { bindDiffView, systemDiffPath } from './DiffView'
import { check, nextContext } from './testing'

afterEach(cleanup)

describe('bindDiffView', () => {
  it('binds the largest file of the biggest open pull request with its patch', async () => {
    const ctx = await nextContext()
    const path = systemDiffPath(ctx, 99178)!
    expect(path).toBe('test/unit/eval-browser-js/sdk-lifecycle.cjs')
    const { node, warnings } = check(bindDiffView(ctx, { repo: 'vercel/next.js', pr: 99178, path, open: false }))
    expect(warnings).toEqual([])
    expect(node.state).toBe('default')
    expect(node.props).toMatchObject({ status: 'added', additions: 289, deletions: 0, patch: expect.stringMatching(/^@@/) })

    const { container } = render(createElement(PIECES.DiffView!.Component, { props: node.props, state: node.state }))
    expect(container.textContent).toContain('sdk-lifecycle.cjs')
  })

  it('says plainly when a file has no patch in the data, and when the file is not in the pull request', async () => {
    const ctx = await nextContext()
    const missing = check(bindDiffView(ctx, { repo: 'vercel/next.js', pr: 99178, path: 'evals/lib/setup.ts' }))
    expect(missing.node.state).toBe('error')
    expect(missing.node.error).toEqual({ failed: "Couldn't load this diff", cause: "This file's diff is not in this answer's data" })
    expect(missing.node.props).toMatchObject({ additions: 14, deletions: 1 })

    const stranger = check(bindDiffView(ctx, { repo: 'vercel/next.js', pr: 99178, path: 'nope.ts' }))
    expect(stranger.node.error).toEqual({ failed: "Couldn't load this diff", cause: "Not one of #99178's files" })
  })
})
