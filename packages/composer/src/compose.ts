import { createLogger } from '@genui-github/core'
import {
  buildContext,
  canonicalSample,
  GitHubError,
  isSample,
  LIVE_TTL_SECONDS,
  parseRepoInput,
  resolveRepo,
  type Cache,
  type DataContext,
  type DatedCache,
  type GitHubClient,
  type RepoRef,
} from '@genui-github/data/server'
import type { WarmingStatus } from '@genui-github/data'
import { registry } from '@genui-github/ui/registry'
import { toStream, type Built, type Composition, type Piece, type StreamOp } from '@genui-github/renderer/core'
import { sumUsage, type CallUsage, type ModelClient } from './anthropic'
import { classify, type Classification } from './classify'
import { fill } from './fill'
import { goldenComposition } from './golden'
import { dayOf, resetAt, VISITOR_LIMIT, type Limits } from './limits'
import { composeOffTemplate } from './offTemplate'
import { enforceRules } from './rules'
import { primeSampleCache } from './samples'
import { needsFor, offTemplateNeeds, TEMPLATE_NEEDS, type TemplateId } from './templates/needs'
import { TEMPLATES } from './templates/registry'
import { chose, type TemplateParams } from './templates/template'

// The whole pipeline (docs/composer.md): golden cache, limits, classify, data, template or Sonnet, rules,
// stream. Everything it touches is injected, so tests run it with no network and no model.

const log = createLogger('composer:compose')

/** The system's sentences for the screens that are not answers (docs/composer.md, System sentences). */
export const SYSTEM_SENTENCES = {
  composeFailed: "Couldn't write an answer to this question.",
  dailyCap: 'Live questions are paused for today. Sample repos and cached answers still work.',
  visitorLimit: (n: number) => `That's today's ${n} live questions. Sample repos and cached answers still work.`,
  rateLimit: (time: string) => `GitHub's rate limit resets at ${time}.`,
  warming: (repo: string) => `GitHub is still counting ${repo}.`,
} as const

export interface ComposeInput {
  repo: string
  question: string
  from?: { id: string; ask: string }
  timeZone?: string
  frameWidth?: number
}

export interface ComposeDeps {
  models: ModelClient
  github: GitHubClient
  cache: Cache
  /** A fresh in-memory cache per sample request: samples answer offline from their committed copy. */
  sampleCache?: () => DatedCache
  limits: Limits
  visitor: string
  /** USD; at or over it the site serves only samples and cached answers. */
  dailyCapUsd: number
  now?: () => number
  /** The warming status the shell got last time, while GitHub counts. */
  warming?: WarmingStatus | null
}

/** Why a question was refused before anything streamed: the route turns these into its status codes. */
export type Refusal =
  | { kind: 'repo'; message: string }
  | { kind: 'visitor-limit'; message: string; resetAt: string }
  | { kind: 'daily-cap'; message: string; resetAt: string }
  | { kind: 'rate-limit'; message: string; resetAt?: string }

export type ComposeOutcome = { kind: 'stream'; ops: AsyncIterable<StreamOp> } | { kind: 'refused'; refusal: Refusal }

const timeWords = (iso: string | undefined, zone = 'UTC') =>
  iso ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' }).format(new Date(iso)) : 'a later time'

/** Replays a finished composition as stream ops, insight first, then metrics, then the regions, then done. */
async function* replay(composition: Composition): AsyncIterable<StreamOp> {
  for (const op of toStream(composition)) yield op
}

/**
 * Decides, before anything streams, whether this question can be answered and how. A golden question on a
 * sample repo is served from its committed composition with no model and no GitHub call, limits or not.
 */
export async function compose(input: ComposeInput, deps: ComposeDeps): Promise<ComposeOutcome> {
  const now = deps.now ?? Date.now
  const started = now()
  const parsed = parseRepoInput(input.repo)
  if (!parsed.ok) return { kind: 'refused', refusal: { kind: 'repo', message: parsed.message } }
  const sample = isSample(parsed) ? canonicalSample(parsed) : null

  if (sample && !input.from) {
    const golden = goldenComposition(sample, input.question)
    if (golden) return { kind: 'stream', ops: replay({ ...golden, built: { ...golden.built, latencyMs: { ...golden.built.latencyMs, total: now() - started } } }) }
  }

  const day = dayOf(started)
  if ((await deps.limits.spend(day)) >= deps.dailyCapUsd) {
    return { kind: 'refused', refusal: { kind: 'daily-cap', message: SYSTEM_SENTENCES.dailyCap, resetAt: resetAt(started) } }
  }
  if ((await deps.limits.visitorCount(deps.visitor, day)) >= VISITOR_LIMIT) {
    return { kind: 'refused', refusal: { kind: 'visitor-limit', message: SYSTEM_SENTENCES.visitorLimit(VISITOR_LIMIT), resetAt: resetAt(started) } }
  }

  let repo: RepoRef
  if (sample) repo = sample
  else {
    try {
      const resolved = await resolveRepo(deps.github, input.repo)
      if (!resolved.ok) return { kind: 'refused', refusal: { kind: 'repo', message: resolved.message } }
      repo = { owner: resolved.owner, name: resolved.name }
    } catch (error) {
      if (error instanceof GitHubError && error.rateLimited) {
        return { kind: 'refused', refusal: { kind: 'rate-limit', message: SYSTEM_SENTENCES.rateLimit(timeWords(error.resetAt, input.timeZone)), resetAt: error.resetAt } }
      }
      throw error
    }
  }

  await deps.limits.countVisitor(deps.visitor, day)
  return { kind: 'stream', ops: run(input, deps, repo, Boolean(sample), started) }
}

async function* run(input: ComposeInput, deps: ComposeDeps, repo: RepoRef, sample: boolean, started: number): AsyncIterable<StreamOp> {
  const now = deps.now ?? Date.now
  const calls: CallUsage[] = []
  const day = dayOf(started)
  const spend = async (usage: CallUsage | null) => {
    if (!usage) return
    calls.push(usage)
    await deps.limits.addSpend(day, usage.costUsd)
  }
  const id = `cmp-${started.toString(36)}`

  try {
    const cache = sample ? await primeSampleCache(repo, deps.sampleCache) : deps.cache
    const sampleNow = sample && 'now' in cache ? (cache as { now?: number }).now : undefined

    const tClassify = now()
    const summaryCtx = await buildContext(deps.github, cache, repo, { shapes: ['repo', 'activity'], measures: [] }, { now: sampleNow, offline: sample, ttlSeconds: sample ? null : LIVE_TTL_SECONDS })
    const r = summaryCtx.shapes.repo!
    const { result: route, usage: classifyUsage } = await classify(deps.models, {
      question: input.question,
      summary: { repo: `${r.owner}/${r.name}`, language: r.primaryLanguage, stars: r.stars, openPulls: summaryCtx.shapes.activity?.open.pulls ?? null, openIssues: r.openIssues, pushedAt: r.pushedAt },
      ...(input.from ? { from: input.from } : {}),
    })
    await spend(classifyUsage)
    const classifyMs = now() - tClassify

    const template = route.template === 'off-template' ? null : route.template
    const params = paramsOf(route)
    const tData = now()
    const ctx = await buildContext(deps.github, cache, repo, template ? needsFor(template, scopeOf(template, params)) : offTemplateNeeds(), {
      now: sampleNow,
      offline: sample,
      ttlSeconds: sample ? null : LIVE_TTL_SECONDS,
      timeZone: input.timeZone,
      warming: deps.warming,
    })
    const dataMs = now() - tData

    if (ctx.warming?.phase === 'warming') {
      yield* warmingScreen(id, ctx, built(template ?? 'off-template', calls, { classifyMs, dataMs, composeMs: 0, started, now }, ctx, ['WarmingUp']))
      return
    }

    const tCompose = now()
    if (template) {
      const screen = TEMPLATES[template]!.compose(ctx, params)
      const filled = await fill(deps.models, ctx, screen, input.question)
      await spend(filled.usage)
      const composition: Composition = { id, density: filled.screen.density, regions: filled.screen.regions, asks: filled.screen.asks, built: built(template, calls, { classifyMs, dataMs, composeMs: now() - tCompose, started, now }, ctx, chose(filled.screen.regions)) }
      const { composition: kept } = enforceRules(composition, { question: input.question })
      yield* replay({ ...kept, built: { ...kept.built, latencyMs: { ...kept.built.latencyMs, total: now() - started } } })
      return
    }

    // Off-template: each piece streams as soon as Sonnet has written it and it has passed the rules.
    const sofar: Composition = { id, density: 'comfortable', regions: { insight: [], metrics: [], main: [], side: [], action: [] }, asks: [], built: built('off-template', calls, { classifyMs, dataMs, composeMs: 0, started, now }, ctx, []) }
    const queue: StreamOp[] = []
    let started_ = false
    const result = await composeOffTemplate(deps.models, ctx, input.question, {
      frameWidth: input.frameWidth,
      onOp: op => {
        if (op.op === 'start') {
          sofar.density = op.density
          sofar.asks = op.asks
          return
        }
        if (op.op === 'dropped') return
        const next = { ...sofar, regions: { ...sofar.regions, [op.region]: [...sofar.regions[op.region], op.piece] } }
        const { composition: kept } = enforceRules(next, { question: input.question, log: quiet })
        if (!keptPiece(kept, op.piece)) return
        if (!started_) {
          queue.push({ op: 'start', id, density: sofar.density, asks: enforceRules(sofar, { log: quiet }).composition.asks })
          started_ = true
        }
        sofar.regions = next.regions
        queue.push({ op: 'add', region: op.region, piece: op.piece })
      },
    })
    await spend(result.usage)
    if (!started_) queue.push({ op: 'start', id, density: sofar.density, asks: [] })
    yield* queue
    const done = built('off-template', calls, { classifyMs, dataMs, composeMs: now() - tCompose, started, now }, ctx, chose(sofar.regions))
    yield { op: 'done', built: { ...done, reason: 'no template matched' } }
  } catch (error) {
    log.error('composition failed', { error: (error as Error).message })
    if (error instanceof GitHubError && error.rateLimited) yield { op: 'error', reason: SYSTEM_SENTENCES.rateLimit(timeWords(error.resetAt, input.timeZone)) }
    else yield { op: 'error', reason: SYSTEM_SENTENCES.composeFailed }
  }
}

const quiet = createLogger('composer:compose', { sink: () => {} })

function keptPiece(composition: Composition, piece: Piece): boolean {
  return Object.values(composition.regions).some(list => list.some(p => p.id === piece.id))
}

function paramsOf(c: Classification): TemplateParams {
  const p = c.params
  return {
    ...(p.pr !== null ? { pr: p.pr } : {}),
    ...(p.handle !== null ? { handle: p.handle } : {}),
    ...(p.branch !== null ? { branch: p.branch } : {}),
    ...(p.window !== null ? { window: p.window } : {}),
    ...(p.day !== null ? { day: p.day } : {}),
    ...(p.weekday !== null ? { weekday: p.weekday } : {}),
    ...(p.hour !== null ? { hour: p.hour } : {}),
  }
}

function scopeOf(template: TemplateId, params: TemplateParams) {
  const kind = TEMPLATE_NEEDS[template].scope
  if (kind === 'pr' && params.pr) return { pr: params.pr }
  if (kind === 'author' && params.handle) return { author: params.handle }
  return {}
}

/** Every Built field (docs/schemas.md), written by the system. */
function built(
  template: TemplateId | 'off-template',
  calls: readonly CallUsage[],
  t: { classifyMs: number; dataMs: number; composeMs: number; started: number; now: () => number },
  ctx: DataContext,
  components: string[],
): Built {
  const { tokens, costUsd } = sumUsage(calls)
  const last = calls.at(-1)
  return {
    template,
    model: last?.model ?? 'none',
    tokens,
    costUsd: Number(costUsd.toFixed(6)),
    latencyMs: { classify: t.classifyMs, data: t.dataMs, compose: t.composeMs, total: t.now() - t.started },
    githubReads: ctx.githubReads,
    chose: components,
  }
}

/** While GitHub counts: the WarmingUp card in main, which says the system sentence itself. */
async function* warmingScreen(id: string, ctx: DataContext, b: Built): AsyncIterable<StreamOp> {
  const status = ctx.warming!
  const piece: Piece = { id: registry.deriveId('WarmingUp', status), component: 'WarmingUp', props: status, bound: status }
  yield { op: 'start', id, density: 'comfortable', asks: [] }
  yield { op: 'add', region: 'main', piece }
  yield { op: 'done', built: b }
}
