// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindKeyValue } from './KeyValue'
import type { KeyValueProps } from './group-a-ui'

afterEach(cleanup)

const value = (props: KeyValueProps, key: string) => props.pairs.find(p => p.key === key)?.value

describe('bindKeyValue', () => {
  it('fills the repo facts, at most eight', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindKeyValue(ctx, { source: 'repo' }), 'side')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as KeyValueProps
    expect(props).toMatchObject({ title: 'vercel/next.js', meta: 'public · MIT' })
    expect(props.pairs).toHaveLength(8)
    expect(value(props, 'stars')).toBe(143038)
    expect(value(props, 'default-branch')).toBe('canary')
    expect(draw(node).container.textContent).toContain('vercel/next.js')
  })

  it('fills a pull request and the latest release', async () => {
    const ctx = await nextContext()
    const pr = check(bindKeyValue(ctx, { source: 'pr', scope: { pr: 95360 } }), 'side').node.props as KeyValueProps
    expect(pr).toMatchObject({ title: 'Pull request #95360', meta: 'open · draft' })
    expect(value(pr, 'lines')).toBe(42)
    const release = check(bindKeyValue(ctx, { source: 'release' }), 'side')
    expect(release.node.props).toMatchObject({ title: 'Release v16.5.0-canary.5', meta: 'latest' })
    draw(release.node)
  })

  it('is unavailable for a pull request the data does not hold', async () => {
    const ctx = await nextContext()
    const { node } = check(bindKeyValue(ctx, { source: 'pr', scope: { pr: 1 } }), 'side')
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't load pull request facts", cause: "#1 is not in this answer's data" })
    draw(node)
  })
})
