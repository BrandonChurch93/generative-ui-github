import { describe, expect, it } from 'vitest'
import { fixtureClient } from '../../github/fixtures'
import { run } from './readme.record'

describe('fetchReadme', () => {
  it('decodes the README from base64', async () => {
    const { client, misses } = fixtureClient('rest-readme')
    const { path, text } = await run(client)
    expect(path).toBe('readme.md')
    expect(text.startsWith('<div align="center">')).toBe(true)
    expect(misses).toEqual([])
  })
})
