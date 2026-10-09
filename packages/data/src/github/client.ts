import { Octokit } from '@octokit/core'
import { createLogger, type Logger } from '@genui-github/core'

// The one door to GitHub. Server side only: the token never leaves this module.

const log = createLogger('data:github')

/** Retries for a 502, 503 or 504, in milliseconds: twice, after 1s and then 3s (docs/data-layer.md). */
export const RETRY_DELAYS_MS = [1000, 3000] as const
const RETRYABLE = new Set([502, 503, 504])
const LOW_RATE = 500

export class GitHubError extends Error {
  readonly status: number
  /** The route as called, such as `GET /repos/{owner}/{repo}/pulls`. */
  readonly endpoint: string
  /** When the rate limit resets, ISO. */
  readonly resetAt?: string
  /** Seconds GitHub asked us to wait. */
  readonly retryAfter?: number
  /** How many times the request was sent. */
  readonly attempts: number

  constructor(init: { status: number; endpoint: string; message: string; resetAt?: string; retryAfter?: number; attempts?: number }) {
    super(init.message)
    this.name = 'GitHubError'
    this.status = init.status
    this.endpoint = init.endpoint
    this.resetAt = init.resetAt
    this.retryAfter = init.retryAfter
    this.attempts = init.attempts ?? 1
  }

  get rateLimited(): boolean {
    return (this.status === 403 || this.status === 429) && (this.resetAt !== undefined || this.retryAfter !== undefined)
  }

  /** The cause in the reader's words, for an error state's meta line. */
  get reason(): string {
    if (this.rateLimited) return `GitHub's rate limit resets at ${this.resetAt ?? 'a later time'}`
    const tried = this.attempts > 1 ? ' · tried twice' : ''
    return `GitHub returned ${this.status}${tried}`
  }
}

export interface RestResponse<T> {
  status: number
  data: T
  headers: Record<string, string | number | undefined>
}

export interface GitHubClient {
  rest<T = unknown>(route: string, params?: Record<string, unknown>): Promise<RestResponse<T>>
  graphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>
  /** Requests sent so far, retries included: what a refresh cost. */
  readonly requests: number
}

export interface ClientOptions {
  token: string
  /** Swapped for a replay in tests, so they never touch the network. */
  fetch?: typeof fetch
  log?: Logger
  sleep?: (ms: number) => Promise<void>
}

type Headers = Record<string, string | number | undefined>

function header(headers: Headers | undefined, name: string): string | undefined {
  const value = headers?.[name]
  return value === undefined ? undefined : String(value)
}

function limits(headers: Headers | undefined): { resetAt?: string; retryAfter?: number } {
  const reset = header(headers, 'x-ratelimit-reset')
  const retry = header(headers, 'retry-after')
  return {
    resetAt: reset && Number.isFinite(Number(reset)) ? new Date(Number(reset) * 1000).toISOString() : undefined,
    retryAfter: retry && Number.isFinite(Number(retry)) ? Number(retry) : undefined,
  }
}

interface OctokitFailure {
  status?: number
  message?: string
  response?: { headers?: Headers }
}

function toGitHubError(error: unknown, endpoint: string, attempts: number): GitHubError {
  if (error instanceof GitHubError) return error
  const failure = (error ?? {}) as OctokitFailure
  const status = typeof failure.status === 'number' ? failure.status : 0
  const headers = failure.response?.headers
  const rate = status === 403 || status === 429 ? limits(headers) : {}
  // A 403 that is not about the rate limit (a blocked repo, a missing scope) carries no reset time.
  const isRate = status === 429 || header(headers, 'x-ratelimit-remaining') === '0' || rate.retryAfter !== undefined
  return new GitHubError({
    status,
    endpoint,
    message: failure.message ?? `GitHub request failed: ${endpoint}`,
    ...(isRate ? rate : {}),
    attempts,
  })
}

const sleepFor = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export function createGitHubClient(options: ClientOptions): GitHubClient {
  const logger = options.log ?? log
  const sleep = options.sleep ?? sleepFor
  let requests = 0
  const octokit = new Octokit({
    auth: options.token,
    userAgent: 'generative-ui-github',
    request: options.fetch ? { fetch: options.fetch } : undefined,
  })

  octokit.hook.wrap('request', async (request, endpointOptions) => {
    const endpoint = `${endpointOptions.method} ${endpointOptions.url}`
    for (let attempt = 1; ; attempt++) {
      requests += 1
      try {
        const response = await request(endpointOptions)
        const remaining = header(response.headers as Headers, 'x-ratelimit-remaining')
        if (remaining !== undefined) {
          const left = Number(remaining)
          if (left < LOW_RATE) logger.warn('GitHub rate limit running low', { remaining: left, endpoint })
          else logger.debug('GitHub rate limit', { remaining: left, endpoint })
        }
        return response
      } catch (error) {
        const status = (error as OctokitFailure).status
        const delay = RETRY_DELAYS_MS[attempt - 1]
        if (status !== undefined && RETRYABLE.has(status) && delay !== undefined) {
          logger.warn('GitHub server error, retrying', { status, endpoint, attempt, delayMs: delay })
          await sleep(delay)
          continue
        }
        throw toGitHubError(error, endpoint, attempt)
      }
    }
  })

  return {
    async rest<T>(route: string, params: Record<string, unknown> = {}) {
      const response = await octokit.request(route, params)
      return { status: response.status, data: response.data as T, headers: response.headers as Headers }
    },
    async graphql<T>(query: string, variables: Record<string, unknown> = {}) {
      try {
        return await octokit.graphql<T>(query, variables)
      } catch (error) {
        // GraphQL reports a missing repository as a 200 with an error of type NOT_FOUND.
        const errors = (error as { errors?: { type?: string; message?: string }[] }).errors
        if (errors?.some(e => e.type === 'NOT_FOUND')) {
          throw new GitHubError({ status: 404, endpoint: 'POST /graphql', message: errors[0]?.message ?? 'Not found' })
        }
        throw toGitHubError(error, 'POST /graphql', 1)
      }
    },
    get requests() {
      return requests
    },
  }
}
