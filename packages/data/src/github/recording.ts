import { createHash } from 'node:crypto'

// Fixtures are real GitHub responses, recorded once with `pnpm --filter @genui-github/data fixtures:record`
// and replayed by every test after that, so no test touches the network.

export interface RecordedResponse {
  key: string
  status: number
  headers: Record<string, string>
  body: unknown
}

export interface Recording {
  recordedAt: string
  responses: RecordedResponse[]
}

/** Response headers worth keeping. Nothing that identifies the token is ever written. */
const KEPT_HEADERS = ['content-type', 'link', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-resource']

function bodyText(init: RequestInit | undefined): string {
  return typeof init?.body === 'string' ? init.body : ''
}

/** Method, path and query, plus a hash of a GraphQL body: the same request always gets the same key. */
export function requestKey(input: string | URL | Request, init?: RequestInit): string {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const body = bodyText(init)
  const hash = body ? ` ${createHash('sha256').update(body).digest('hex').slice(0, 16)}` : ''
  return `${method} ${url.pathname}${url.search}${hash}`
}

export function recordingFetch(recording: Recording, real: typeof fetch = fetch, transform?: (key: string, body: unknown) => unknown): typeof fetch {
  return async (input, init) => {
    const response = await real(input, init)
    const text = await response.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : ''
    } catch {
      // Not JSON (a raw README, an empty 202): kept as text.
    }
    const key = requestKey(input, init)
    const headers = Object.fromEntries(KEPT_HEADERS.flatMap(h => (response.headers.get(h) ? [[h, response.headers.get(h)!]] : [])))
    const kept = transform ? transform(key, body) : body
    recording.responses.push({ key, status: response.status, headers, body: kept })
    return new Response(typeof kept === 'string' ? kept : JSON.stringify(kept), { status: response.status, headers: response.headers })
  }
}

/**
 * Replays recorded responses in order: the same key recorded twice (a 202, then a 200) answers the
 * first call with the first response and every later call with the next, staying on the last.
 */
export function replayFetch(recording: Recording): typeof fetch & { misses: string[] } {
  const queues = new Map<string, RecordedResponse[]>()
  for (const r of recording.responses) queues.set(r.key, [...(queues.get(r.key) ?? []), r])
  const misses: string[] = []
  const replay = async (input: string | URL | Request, init?: RequestInit) => {
    const key = requestKey(input, init)
    const queue = queues.get(key)
    if (!queue?.length) {
      misses.push(key)
      return new Response(JSON.stringify({ message: `No recorded response for ${key}` }), { status: 599, headers: { 'content-type': 'application/json' } })
    }
    const next = queue.length > 1 ? queue.shift()! : queue[0]!
    const body = next.body === '' ? null : typeof next.body === 'string' ? next.body : JSON.stringify(next.body)
    return new Response(next.status === 204 ? null : body, { status: next.status, headers: { 'content-type': 'application/json', ...next.headers } })
  }
  return Object.assign(replay as typeof fetch, { misses })
}
