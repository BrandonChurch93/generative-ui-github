// Records GitHub fixtures from real calls: `pnpm --filter @genui-github/data fixtures:record [name...]`.
// Each `src/**/*.record.ts` exports `scenario`. Tests replay the JSON this writes and never touch the network.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createGitHubClient } from '../src/github/client'
import { FIXTURE_DIR, type Scenario } from '../src/github/fixtures'
import { recordingFetch, type Recording } from '../src/github/recording'

const root = fileURLToPath(new URL('..', import.meta.url))
process.loadEnvFile(join(root, '../../.env.local'))
const token = process.env.GITHUB_TOKEN
if (!token) throw new Error('GITHUB_TOKEN is not set in .env.local')

function find(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? find(path) : name.endsWith('.record.ts') ? [path] : []
  })
}

const wanted = new Set(process.argv.slice(2))
let total = 0
for (const file of find(join(root, 'src'))) {
  const { scenario } = (await import(pathToFileURL(file).href)) as { scenario: Scenario }
  if (wanted.size && !wanted.has(scenario.name)) continue
  const recording: Recording = { recordedAt: new Date().toISOString(), responses: [] }
  const client = createGitHubClient({ token, fetch: recordingFetch(recording, fetch, scenario.trim) })
  await scenario.run(client)
  writeFileSync(`${FIXTURE_DIR}${scenario.name}.json`, `${JSON.stringify(recording, null, 1)}\n`)
  total += client.requests
  process.stdout.write(`${scenario.name}: ${client.requests} requests, ${recording.responses.length} responses\n`)
}
process.stdout.write(`total: ${total} GitHub requests\n`)
