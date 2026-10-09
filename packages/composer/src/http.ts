import { z } from 'zod'
import type { WarmingStatus } from '@genui-github/data'
import { compose, type ComposeDeps, type Refusal } from './compose'
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
  const visitor = visitorOf(request)
  const outcome = await compose(
    { repo: body.repo, question: body.question, from: body.from, timeZone: body.timeZone, frameWidth: body.frameWidth },
    { ...deps(visitor), visitor, warming: (body.warming as WarmingStatus | undefined) ?? null },
  )
  if (outcome.kind === 'refused') return json(STATUS[outcome.refusal.kind], { error: outcome.refusal.kind, ...outcome.refusal })
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const op of outcome.ops) controller.enqueue(encoder.encode(`${JSON.stringify(op)}\n`))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } })
}
