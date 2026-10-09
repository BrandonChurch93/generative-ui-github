// `tsx scripts/near-empty-refresh.ts`: records the data context of one real, tiny public repo (a handful of
// commits, no pull requests, no releases) for `?force=empty`, with the machinery `pnpm samples:refresh` uses:
// every cache entry the context build writes is kept, and GitHub's 202s are waited out on the warming schedule.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MEASURE_IDS, SHAPE_NAMES, type WarmingStatus } from '@genui-github/data'
import { buildContext, createGitHubClient, memoryCache, type Cache, type ContextNeeds, type SampleFile } from '@genui-github/data/server'
import { NEAR_EMPTY_DIR, NEAR_EMPTY_FILE, NEAR_EMPTY_REPO } from '../src/nearEmpty'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(`${root}../../.env.local`)
const token = process.env.GITHUB_TOKEN
if (!token) throw new Error('GITHUB_TOKEN is not set in .env.local')
const out = (line: string) => process.stdout.write(`${line}\n`)

// The samples' needs: every shape but the tree and code frequency, every measure.
const EVERYTHING: ContextNeeds = { shapes: SHAPE_NAMES.filter(s => s !== 'tree' && s !== 'stats.codeFrequency'), measures: MEASURE_IDS }
const PATIENCE = 4

const repo = NEAR_EMPTY_REPO
const client = createGitHubClient({ token })
const memory = memoryCache()
const entries: SampleFile['entries'] = {}
const recording: Cache = {
  get: key => memory.get(key),
  async set(key, value, ttl) {
    await memory.set(key, value, ttl)
    entries[key] = (await memory.get(key))!
  },
}
const now = Date.now()
let warming: WarmingStatus | null = null
let ctx = await buildContext(client, recording, repo, EVERYTHING, { ttlSeconds: null, now })
for (let run = 1; ctx.warming && run <= PATIENCE; run++) {
  while (ctx.warming && ctx.warming.phase === 'warming') {
    warming = ctx.warming
    out(`  GitHub is counting, run ${run}, check ${warming.attempt}, next in ${warming.nextCheckMs}ms`)
    await new Promise(r => setTimeout(r, warming!.nextCheckMs))
    ctx = await buildContext(client, recording, repo, EVERYTHING, { ttlSeconds: null, warming, now: Date.now() })
  }
  if (ctx.warming && run < PATIENCE) ctx = await buildContext(client, recording, repo, EVERYTHING, { ttlSeconds: null, now: Date.now() })
}
for (const key of Object.keys(entries)) if (key.includes(':last-copy:')) delete entries[key]

const r = ctx.shapes.repo!
const file: SampleFile = { repo: `${ctx.repo.owner}/${ctx.repo.name}`, sha: ctx.repo.sha, now, refreshedAt: new Date().toISOString(), githubRequests: client.requests, entries }
mkdirSync(NEAR_EMPTY_DIR, { recursive: true })
writeFileSync(NEAR_EMPTY_FILE, JSON.stringify(file))
const missing = ctx.warming?.stats.filter(s => s.state === 'missing').map(s => s.id) ?? []
out(`${file.repo}: ${client.requests} GitHub requests, ${Object.keys(entries).length} entries · ${r.openIssues} open issues · pushed ${r.pushedAt}`)
if (missing.length) out(`still missing ${missing.join(', ')}`)
if (ctx.unavailable.length) out(`unavailable ${ctx.unavailable.join(', ')}`)
