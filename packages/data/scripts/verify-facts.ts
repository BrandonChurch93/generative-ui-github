// Task 4.5: checks the five unverified facts in docs/data-layer.md with real calls, and prints what it saw.
// `pnpm --filter @genui-github/data facts:verify [--sha-wait-minutes=30]`
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync } from 'node:fs'
import { createGitHubClient, GitHubError, type GitHubClient } from '../src/github/client'
import type { Recording } from '../src/github/recording'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(join(root, '../../.env.local'))
const client = createGitHubClient({ token: process.env.GITHUB_TOKEN! })
const out = (line: string) => process.stdout.write(`${line}\n`)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const waitArg = process.argv.find(a => a.startsWith('--sha-wait-minutes='))
const shaWaitMinutes = waitArg ? Number(waitArg.split('=')[1]) : 30
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const only = arg('only')
const shaRepo = (arg('repo') ?? 'vercel/next.js').split('/') as [string, string]
const shaBranch = arg('branch') ?? 'canary'
const want = (n: string) => !only || only.split(',').includes(n)

async function status(c: GitHubClient, route: string, params: Record<string, unknown>): Promise<number> {
  try {
    return (await c.rest(route, params)).status
  } catch (error) {
    if (error instanceof GitHubError) return error.status
    throw error
  }
}

async function settled<T>(route: string, params: Record<string, unknown>): Promise<T> {
  for (let i = 0; i < 12; i++) {
    const r = await client.rest<T>(route, params)
    if (r.status === 200) return r.data
    await sleep(5000)
  }
  throw new Error(`${route} never left 202`)
}

const STATS = ['contributors', 'participation', 'commit_activity', 'punch_card', 'code_frequency'] as const

if (want('1')) {
// 1. Which endpoints answered 202: every recording made so far, plus a pass over the stats of a cold repo.
out('## 1 · 202 only from /stats/*')
const fixtures = join(root, 'fixtures/github')
const seen = new Map<string, Set<number>>()
for (const file of readdirSync(fixtures)) {
  const rec = JSON.parse(readFileSync(join(fixtures, file), 'utf8')) as Recording
  for (const r of rec.responses) {
    const path = r.key.split(' ')[1]!.split('?')[0]!.replace(/\/repos\/[^/]+\/[^/]+/, '/repos/{o}/{r}').replace(/\/\d+(?=\/|$)/g, '/{n}')
    seen.set(path, (seen.get(path) ?? new Set()).add(r.status))
  }
}
for (const [path, statuses] of [...seen].sort()) out(`${path}: ${[...statuses].join(', ')}`)

}

if (want('4')) {
// 4. Punch card window: its total against the 52-week commit activity and the contributors' all-time total.
out('\n## 4 · punch card all-time or windowed')
for (const [owner, repo] of [['vitejs', 'vite'], ['tailwindlabs', 'tailwindcss']] as const) {
  const punch = await settled<[number, number, number][]>('GET /repos/{owner}/{repo}/stats/punch_card', { owner, repo })
  const activity = await settled<{ total: number }[]>('GET /repos/{owner}/{repo}/stats/commit_activity', { owner, repo })
  const contributors = await settled<{ total: number }[]>('GET /repos/{owner}/{repo}/stats/contributors', { owner, repo })
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  out(`${owner}/${repo}: punch card ${sum(punch.map(c => c[2]))} · 52 weeks ${sum(activity.map(w => w.total))} · contributors all-time ${sum(contributors.map(c => c.total))}`)
}

}

if (want('3')) {
// 3. code_frequency on repos past 10,000 commits.
out('\n## 3 · code_frequency at 10,000+ commits')
for (const [owner, repo] of [['vercel', 'next.js'], ['facebook', 'react'], ['vitejs', 'vite']] as const) {
  const statuses: number[] = []
  for (let i = 0; i < 6; i++) {
    const s = await status(client, 'GET /repos/{owner}/{repo}/stats/code_frequency', { owner, repo })
    statuses.push(s)
    if (s !== 202) break
    await sleep(5000)
  }
  out(`${owner}/${repo}: ${statuses.join(' → ')}`)
}

}

if (want('5')) {
// 5. The files cap: the merged TypeScript pull requests that touch the most files (baseline updates touch thousands).
out('\n## 5 · /pulls/{n}/files cap')
const found = await client.graphql<{ repository: { pullRequests: { nodes: { number: number; changedFiles: number }[] } } }>(
  `query { repository(owner: "microsoft", name: "TypeScript") { pullRequests(states: MERGED, last: 100) { nodes { number changedFiles } } } }`,
)
const big = found.repository.pullRequests.nodes.sort((a, b) => b.changedFiles - a.changedFiles)[0]
if (!big || big.changedFiles <= 3000) out(`no merged pull request over 3,000 files in the last 100 (largest ${big?.changedFiles})`)
else {
  let listed = 0
  let page = 1
  for (; page <= 40; page++) {
    const r = await client.rest<unknown[]>('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { owner: 'microsoft', repo: 'TypeScript', pull_number: big.number, per_page: 100, page })
    listed += r.data.length
    if (r.data.length < 100) break
  }
  out(`microsoft/TypeScript#${big.number}: changedFiles ${big.changedFiles} · listed ${listed} over ${page} pages`)
}

}

if (want('2')) {
// 2. Stats per default-branch SHA: warm the stats of a busy repo, wait for its next push, ask again at once.
out('\n## 2 · stats cached per default-branch SHA')
const [owner, repo] = shaRepo
const head = async () => (await client.rest<{ object: { sha: string } }>('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${shaBranch}` })).data.object.sha
for (const s of STATS) await settled(`GET /repos/{owner}/{repo}/stats/${s}`, { owner, repo }).catch(() => null)
const before = await head()
const warm = await Promise.all(STATS.map(s => status(client, `GET /repos/{owner}/{repo}/stats/${s}`, { owner, repo })))
out(`at ${before.slice(0, 7)}: ${STATS.map((s, i) => `${s} ${warm[i]}`).join(' · ')}`)
const deadline = Date.now() + shaWaitMinutes * 60_000
let after = before
while (after === before && Date.now() < deadline) {
  await sleep(30_000)
  after = await head()
}
if (after === before) out(`no push to ${owner}/${repo}@${shaBranch} within ${shaWaitMinutes} minutes`)
else {
  const cold = await Promise.all(STATS.map(s => status(client, `GET /repos/{owner}/{repo}/stats/${s}`, { owner, repo })))
  out(`after the push to ${after.slice(0, 7)}: ${STATS.map((s, i) => `${s} ${cold[i]}`).join(' · ')}`)
}
}
out(`\n${client.requests} GitHub requests`)
