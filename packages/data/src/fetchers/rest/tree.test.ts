import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './tree.record'

describe('fetchTree', () => {
  it('lists every path of a small repo with sizes on blobs', async () => {
    const { client, misses } = fixtureClient('rest-tree')
    const tree = await run(client)
    expect(tree.sha).toBe('4ff48cec099f0514c3e9bbca18706c9c21122bfb')
    expect(tree.truncated).toBe(false)
    expect(tree.entries).toHaveLength(28)
    expect(tree.entries[0]).toEqual({ path: '.github', type: 'tree' })
    expect(tree.entries.find(e => e.path === 'src/index.ts')).toEqual({ path: 'src/index.ts', type: 'blob', size: 5864 })
    expect(misses).toEqual([])
  })
})
