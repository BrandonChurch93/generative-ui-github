import { loadConfig } from '@genui-github/core'
import { GOLDEN_QUESTIONS } from './questions'

// Shared by the two load scripts (docs/plan.md 9.3). Both run with DAILY_CAP_USD=0.50 in their env and
// fail with exit code 1 when an assertion does not hold.

export { GOLDEN_QUESTIONS }

export const SAMPLES = ['vercel/next.js', 'facebook/react', 'anthropics/claude-code', 'tailwindlabs/tailwindcss', 'vitejs/vite']

export function capFromEnv(): number {
  const config = loadConfig(process.env)
  if (!config.ok) throw new Error(`Configuration incomplete: ${config.problems.map(p => p.variable).join(', ')}`)
  if (config.config.dailyCapUsd !== 0.5) throw new Error(`Run with DAILY_CAP_USD=0.50 (it is ${config.config.dailyCapUsd})`)
  return config.config.dailyCapUsd
}

export const post = (body: object, ip: string) =>
  new Request('http://load.test/api/compose', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'user-agent': 'load-script', 'x-forwarded-for': ip } })

const failures: string[] = []
export function check(ok: boolean, what: string) {
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${what}\n`)
  if (!ok) failures.push(what)
}

export function finish(name: string) {
  process.stdout.write(failures.length ? `${name}: ${failures.length} failed\n` : `${name}: passed\n`)
  process.exit(failures.length ? 1 : 0)
}
