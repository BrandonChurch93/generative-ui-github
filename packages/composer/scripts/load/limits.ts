// 50 live questions from 5 visitors through the route's own handler. The model is a stand-in with a fixed
// price per call, so the script checks the limits' arithmetic, not a model, and spends nothing: the first
// visitor's 16th question trips the visitor limit, then the day's spend reaches DAILY_CAP_USD and trips the cap.
import { MODELS } from '@genui-github/core'
import { memoryCache } from '@genui-github/data/server'
import { composeResponse, memoryLimits, noNetwork, VISITOR_LIMIT, type CallUsage, type ModelClient } from '../../src'
import { capFromEnv, check, finish, post } from './shared'

process.env.GITHUB_TOKEN ||= 'unused-by-this-script'
process.env.ANTHROPIC_API_KEY ||= 'unused-by-this-script'
process.env.DAILY_CAP_USD = '0.50'
const cap = capFromEnv()

/** Each call costs this much; a composition is two calls (classify and fill). */
const PER_CALL = 0.0075
const usage: CallUsage = { model: MODELS.haiku, inputTokens: 1000, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 50, costUsd: PER_CALL, latencyMs: 1 }
const NONE = { pr: null, handle: null, branch: null, window: null, day: null, weekday: null, hour: null }
let modelCalls = 0
const models: ModelClient = {
  async json(options) {
    modelCalls += 1
    const classifying = !options.user.includes('Sentences to rewrite')
    return { value: (classifying ? { template: 'ci-trend', confidence: 0.9, params: NONE } : { slots: [] }) as never, usage, stopReason: 'end_turn' }
  },
  stream() {
    throw new Error('no off-template in this script')
  },
}

const limits = memoryLimits()
const gh = noNetwork()
const deps = () => ({ models, github: gh.client, cache: memoryCache(), limits, dailyCapUsd: cap })

// Paraphrases, never golden, on a sample: live composition without GitHub.
const QUESTIONS = ['are builds taking longer', 'is the pipeline slowing down', 'how slow is ci lately', 'has ci gotten worse', 'build times trend']
const visitors = ['203.0.113.1', '203.0.113.2', '203.0.113.3', '203.0.113.4', '203.0.113.5']
const order = [...Array(16).fill(0), ...Array(15).fill(1), ...Array(15).fill(2), ...Array(4).fill(3)] as number[]

const outcomes: { visitor: number; status: number; error?: string }[] = []
for (const [i, v] of order.entries()) {
  const response = await composeResponse(post({ repo: 'vercel/next.js', question: `${QUESTIONS[i % QUESTIONS.length]} (${i})` }, visitors[v]!), deps)
  const body = response.status === 200 ? (await response.text(), undefined) : ((await response.json()) as { error: string })
  outcomes.push({ visitor: v, status: response.status, ...(body ? { error: body.error } : {}) })
}

const firstVisitorTrip = outcomes.findIndex(o => o.error === 'visitor-limit')
const firstCapTrip = outcomes.findIndex(o => o.error === 'daily-cap')
const composed = outcomes.filter(o => o.status === 200).length
process.stdout.write(`${outcomes.length} questions from ${visitors.length} visitors at DAILY_CAP_USD=${cap.toFixed(2)} · ${composed} composed · ${modelCalls} model calls · $${(modelCalls * PER_CALL).toFixed(4)} counted\n`)
check(outcomes.length === 50, 'fired 50 live questions')
check(firstVisitorTrip === VISITOR_LIMIT, `the visitor limit tripped on visitor 1's question ${VISITOR_LIMIT + 1} (at ${firstVisitorTrip + 1})`)
check(outcomes.slice(0, VISITOR_LIMIT).every(o => o.status === 200), `visitor 1's first ${VISITOR_LIMIT} composed`)
check(firstCapTrip > firstVisitorTrip, `then the daily cap tripped (at question ${firstCapTrip + 1})`)
check(outcomes.slice(firstCapTrip).every(o => o.error === 'daily-cap' || o.error === 'visitor-limit'), 'nothing composed after the cap tripped')
check(composed * 2 * PER_CALL >= cap && (composed - 1) * 2 * PER_CALL < cap, `the cap tripped at the first question after spend reached $${cap.toFixed(2)} (${composed} composed)`)
check(gh.calls.length === 0, `zero GitHub calls (${gh.calls.length})`)
finish('load:limits')
