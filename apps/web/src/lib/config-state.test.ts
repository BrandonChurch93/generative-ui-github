import { describe, expect, it } from 'vitest'
import { loadConfig } from '@genui-github/core'
import { configErrorCopy } from './config-state'

describe('configErrorCopy', () => {
  it('names both missing variables in one cause', () => {
    const result = loadConfig({})
    if (result.ok) throw new Error('expected a config error')
    const copy = configErrorCopy(result.problems)
    expect(copy.failed).toBe("Couldn't start the composer")
    expect(copy.cause).toBe('GITHUB_TOKEN and ANTHROPIC_API_KEY are not set')
  })
})
