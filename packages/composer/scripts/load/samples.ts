// 500 compositions at the five samples, through the route's own handler and the real dependencies, with
// the model and GitHub clients wrapped to count every call. Golden answers must cost nothing.
import { fileURLToPath } from 'node:url'
import type { GitHubClient } from '@genui-github/data/server'
import { composeDeps, composeResponse, type ModelClient } from '../../src'
import { capFromEnv, check, finish, GOLDEN_QUESTIONS, post, SAMPLES } from './shared'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
process.loadEnvFile(`${root}.env.local`)
process.env.DAILY_CAP_USD = '0.50'
const cap = capFromEnv()

const real = await composeDeps()
const calls = { model: 0, github: 0 }
const deps = {
  ...real,
  models: {
    json: ((options: Parameters<ModelClient['json']>[0]) => (calls.model++, real.models.json(options))) as ModelClient['json'],
    stream: (options: Parameters<ModelClient['stream']>[0]) => (calls.model++, real.models.stream(options)),
  } satisfies ModelClient,
  github: {
    requests: 0,
    rest: ((route: string, params?: Record<string, unknown>) => (calls.github++, real.github.rest(route, params))) as GitHubClient['rest'],
    graphql: ((query: string, variables?: Record<string, unknown>) => (calls.github++, real.github.graphql(query, variables))) as GitHubClient['graphql'],
  } satisfies GitHubClient,
}

const started = Date.now()
const statuses = new Map<number, number>()
let complete = 0
const total = 500
const jobs = Array.from({ length: total }, (_, i) => ({ repo: SAMPLES[i % SAMPLES.length]!, question: GOLDEN_QUESTIONS[Math.floor(i / SAMPLES.length) % GOLDEN_QUESTIONS.length]!, ip: `198.51.100.${(i % 50) + 1}` }))
for (let i = 0; i < jobs.length; i += 25) {
  await Promise.all(
    jobs.slice(i, i + 25).map(async job => {
      const response = await composeResponse(post({ repo: job.repo, question: job.question }, job.ip), () => deps)
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1)
      const text = await response.text()
      if (response.status === 200 && text.trim().split('\n').at(-1)?.includes('"op":"done"')) complete += 1
    }),
  )
}

process.stdout.write(`${total} compositions in ${Date.now() - started}ms at DAILY_CAP_USD=${cap.toFixed(2)} · statuses ${JSON.stringify(Object.fromEntries(statuses))}\n`)
check(complete === total, `all ${total} streamed a finished composition (${complete})`)
check(calls.model === 0, `zero model calls (${calls.model})`)
check(calls.github === 0, `zero GitHub calls (${calls.github})`)
finish('load:samples')
