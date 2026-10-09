// `pnpm samples:refresh`: builds the full data context for each sample repo, waits out GitHub's 202s on the
// warming schedule, and writes every cache entry to packages/data/samples/. Prints the GitHub request count.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { memoryCache, type Cache } from '../src/cache/cache'
import { buildContext } from '../src/context'
import { EVERYTHING as ALL } from '../src/context.record'
import { createGitHubClient } from '../src/github/client'
import { SAMPLE_DIR, SAMPLE_REPOS, sampleFileName, type SampleFile } from '../src/samples'
import type { WarmingStatus } from '../src/shapes'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(join(root, '../../.env.local'))
const token = process.env.GITHUB_TOKEN
if (!token) throw new Error('GITHUB_TOKEN is not set in .env.local')
const only = new Set(process.argv.slice(2))
// No template reads code frequency, and on big repos GitHub never counts it (a 422), or counts it last.
const EVERYTHING = { ...ALL, shapes: ALL.shapes.filter(s => s !== 'stats.codeFrequency') }
const out = (line: string) => process.stdout.write(`${line}\n`)
const PATIENCE = 4

let total = 0
for (const repo of SAMPLE_REPOS) {
  if (only.size && !only.has(`${repo.owner}/${repo.name}`)) continue
  const client = createGitHubClient({ token })
  const memory = memoryCache()
  const entries: SampleFile['entries'] = {}
  // Every write the build makes is kept, so the app gets back exactly what the build read.
  const recording: Cache = {
    get: key => memory.get(key),
    async set(key, value, ttl) {
      await memory.set(key, value, ttl)
      entries[key] = (await memory.get(key))!
    },
  }
  let warming: WarmingStatus | null = null
  const now = Date.now()
  let ctx = await buildContext(client, recording, repo, EVERYTHING, { ttlSeconds: null, now })
  // A refresh can wait longer than a reader: a stopped run starts again, up to PATIENCE runs of two minutes.
  for (let run = 1; ctx.warming && run <= PATIENCE; run++) {
    while (ctx.warming && ctx.warming.phase === 'warming') {
      warming = ctx.warming
      out(`  ${repo.owner}/${repo.name}: GitHub is counting, run ${run}, check ${warming.attempt}, next in ${warming.nextCheckMs}ms`)
      await new Promise(r => setTimeout(r, warming!.nextCheckMs))
      ctx = await buildContext(client, recording, repo, EVERYTHING, { ttlSeconds: null, warming, now: Date.now() })
    }
    if (ctx.warming && run < PATIENCE) ctx = await buildContext(client, recording, repo, EVERYTHING, { ttlSeconds: null, now: Date.now() })
  }
  // A sample is cached forever under its own SHA, so the copy kept for a later SHA is never read.
  for (const key of Object.keys(entries)) if (key.includes(':last-copy:')) delete entries[key]
  const file: SampleFile = { repo: `${ctx.repo.owner}/${ctx.repo.name}`, sha: ctx.repo.sha, now, refreshedAt: new Date().toISOString(), githubRequests: client.requests, entries }
  writeFileSync(`${SAMPLE_DIR}${sampleFileName(repo)}`, JSON.stringify(file))
  const missing = ctx.warming?.stats.filter(s => s.state === 'missing').map(s => s.id) ?? []
  out(`${file.repo}: ${client.requests} GitHub requests, ${Object.keys(entries).length} entries${missing.length ? `, still missing ${missing.join(', ')}` : ''}${ctx.unavailable.length ? `, unavailable ${ctx.unavailable.join(', ')}` : ''}`)
  total += client.requests
}
out(`total: ${total} GitHub requests`)
