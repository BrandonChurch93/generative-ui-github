import Anthropic from '@anthropic-ai/sdk'
import { loadConfig } from '@genui-github/core'
import { createCache, createGitHubClient, type DatedCache } from '@genui-github/data/server'
import { createModelClient } from './anthropic'
import type { ComposeDeps } from './compose'
import { kvLimits, memoryLimits, type Limits } from './limits'

// The route's dependencies from the environment, made once per server instance. The token and the key stay here.

let made: Promise<Omit<ComposeDeps, 'visitor'>> | undefined

async function createLimits(env: Record<string, string | undefined>): Promise<Limits> {
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) return memoryLimits()
  const { Redis } = await import('@upstash/redis')
  return kvLimits(new Redis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN }) as never)
}

export function composeDeps(env: Record<string, string | undefined> = process.env): Promise<Omit<ComposeDeps, 'visitor'>> {
  made ??= (async () => {
    const config = loadConfig(env)
    if (!config.ok) throw new Error(`Configuration incomplete: ${config.problems.map(p => p.variable).join(', ')}`)
    const cache: DatedCache = await createCache(env)
    return {
      models: createModelClient(new Anthropic({ apiKey: config.config.anthropicApiKey })),
      github: createGitHubClient({ token: config.config.githubToken }),
      cache,
      limits: await createLimits(env),
      dailyCapUsd: config.config.dailyCapUsd,
    }
  })()
  return made
}
