import { z } from 'zod'
import type { WarmingStatus } from '@genui-github/data'
import type { StreamOp } from '@genui-github/renderer/core'
import { compose, forcedWarming, SYSTEM_SENTENCES, timeWords, type ComposeDeps, type Notice, type Refusal } from './compose'
import { visitorKey } from './limits'

// POST /api/compose as a plain Request to Response, so the Next route is one line and tests need no server.

const bodySchema = z.object({
  repo: z.string().max(300),
  question: z.string().min(1).max(300),
  from: z.object({ id: z.string().max(200), ask: z.string().max(300) }).optional(),
  timeZone: z.string().max(64).optional(),
  frameWidth: z.number().int().min(200).max(4000).optional(),
  warming: z.unknown().optional(),
})

const STATUS: Record<Refusal['kind'], number> = { repo: 400, 'visitor-limit': 429, 'daily-cap': 429, 'rate-limit': 503 }

/** The dev flags that force each screen the shell has to draw without waiting for GitHub to produce it. */
export const FORCES = ['warming', 'ratelimit', 'cap', 'empty'] as const
export type Force = (typeof FORCES)[number]
const isForce = (v: string | null): v is Force => (FORCES as readonly string[]).includes(v ?? '')

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The visitor's counter key from the request: never stored with anything else. */
export function visitorOf(request: Request): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return visitorKey(ip, request.headers.get('user-agent') ?? '')
}

export async function composeResponse(request: Request, deps: (visitor: string) => Omit<ComposeDeps, 'visitor'> & Partial<Pick<ComposeDeps, 'visitor'>>): Promise<Response> {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return json(400, { error: 'bad-request', message: 'Send { repo, question } as JSON' })
  }
  const force = new URL(request.url).searchParams.get('force')
  const forced = isForce(force) ? force : null
  const warming = (body.warming as WarmingStatus | undefined) ?? null
  if (forced === 'ratelimit') {
    const reset = new Date(Date.now() + 12 * 60_000).toISOString()
    return json(503, { error: 'rate-limit', kind: 'rate-limit', message: SYSTEM_SENTENCES.rateLimit(timeWords(reset, body.timeZone)), resetAt: reset })
  }
  if (forced === 'warming') {
    const ops = forcedWarming(body.repo, warming)
    if (ops) return stream(ops, {})
  }
  const visitor = visitorOf(request)
  const given = deps(visitor)
  const outcome = await compose(
    { repo: body.repo, question: body.question, from: body.from, timeZone: body.timeZone, frameWidth: body.frameWidth },
    { ...given, visitor, warming: forced === 'warming' ? null : warming, ...(forced === 'cap' ? { dailyCapUsd: 0 } : {}) },
  )
  if (outcome.kind === 'refused') return json(STATUS[outcome.refusal.kind], { error: outcome.refusal.kind, ...outcome.refusal })
  return stream(outcome.ops, outcome.notice)
}

function stream(ops: AsyncIterable<StreamOp>, notice: Notice): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const op of ops) controller.enqueue(encoder.encode(`${JSON.stringify(op)}\n`))
      controller.close()
    },
  })
  const headers: Record<string, string> = { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' }
  if (notice.served) headers['x-genui-served'] = notice.served
  if (notice.cachedAt) headers['x-genui-cached-at'] = notice.cachedAt
  if (notice.capped) headers['x-genui-capped'] = notice.capped
  return new Response(body, { status: 200, headers })
}
