import { createHash } from 'node:crypto'
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
import { CHECK_SCHEDULE, type WarmingStatus } from '@genui-github/data'
import { registry } from '@genui-github/ui/registry'
import { toStream, type Built, type Composition, type Piece, type StreamOp } from '@genui-github/renderer/core'
import { sumUsage, type CallUsage, type ModelClient } from './anthropic'
import type { ModelId } from '@genui-github/core'
import { classify, type Classification } from './classify'
import { fill } from './fill'
import { goldenComposition, goldenQuestion } from './golden'
import { dayOf, resetAt, VISITOR_LIMIT, type Limits } from './limits'
import { nearEmptyContext, nearEmptyInsight } from './nearEmpty'
import { composeOffTemplate } from './offTemplate'
import { enforceRules, type RuleDrop } from './rules'
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
  /** The eval runner's levers and taps (docs/evals.md). The route never sets these. */
  eval?: EvalOptions
}

export interface EvalOptions {
  /** Compose every question: skip the golden set and the answer cache. */
  fresh?: boolean
  /** `off-template` sends every question to the off-template composer without classifying it (the `sonnet` run). */
  route?: 'classify' | 'off-template'
  /** The model that composes off-template: Sonnet in production, Haiku in the `haiku` run. */
  offTemplateModel?: ModelId
  /** The context the composition was bound from, for the bindings scorer. */
  onContext?: (ctx: DataContext) => void
  /** What the classifier said, before anything is composed. */
  onRoute?: (template: TemplateId | 'off-template') => void
  /** Pieces the composition rules dropped. */
  onDrops?: (drops: RuleDrop[]) => void
}

/** Why a question was refused before anything streamed: the route turns these into its status codes. */
export type Refusal =
  | { kind: 'repo'; message: string }
  | { kind: 'visitor-limit'; message: string; resetAt: string }
  | { kind: 'daily-cap'; message: string; resetAt: string }
  | { kind: 'rate-limit'; message: string; resetAt?: string }

/** What the shell says about an answer it is given: from the cache, and whether new questions are paused. */
export interface Notice {
  /** An answer that was not composed for this request: a committed golden one, or one from the answer cache. */
  served?: 'golden' | 'cache'
  /** When the answer was composed, if it came from the answer cache. */
  cachedAt?: string
  /** Set at the daily cap: when live questions open again. */
  capped?: string
}

export type ComposeOutcome = { kind: 'stream'; ops: AsyncIterable<StreamOp>; notice: Notice } | { kind: 'refused'; refusal: Refusal }

/** "17:58 UTC": the shell's clock, so the sentence and the tray name the same time the same way. */
export const timeWords = (iso: string | undefined, zone = 'UTC') =>
  iso ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone, timeZoneName: 'short' }).format(new Date(iso)) : 'a later time'

/**
 * A composed answer, kept as long as the data under it: what a share URL replays without a model call. Keyed
 * by a hash, so the cache holds no question text.
 */
export const answerKey = (repo: RepoRef, question: string, from?: { id: string; ask: string }) =>
  `answer:${`${repo.owner}/${repo.name}`.toLowerCase()}:${createHash('sha256').update(`${question.trim().toLowerCase().replace(/\s+/g, ' ')}\n${from ? `${from.id}\n${from.ask}` : ''}`).digest('hex').slice(0, 32)}`

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

  const day = dayOf(started)
  // A counter that cannot be read must not take down the answers that need no model.
  const atCap = (await deps.limits.spend(day).catch(() => 0)) >= deps.dailyCapUsd
  const notice: Notice = atCap ? { capped: resetAt(started) } : {}
  // The receipt stays the original composition's: opening a kept answer takes no time worth printing.
  const served = (c: Composition) => replay(c)

  if (sample && !input.from && !deps.eval?.fresh) {
    const golden = goldenComposition(sample, input.question)
    if (golden) return { kind: 'stream', ops: served(golden), notice: { ...notice, served: 'golden' } }
  }

  const cached = deps.eval?.fresh ? null : await deps.cache.get<Composition>(answerKey(sample ?? parsed, input.question, input.from)).catch(() => null)
  if (cached) return { kind: 'stream', ops: served(cached.value), notice: { ...notice, served: 'cache', cachedAt: cached.cachedAt } }

  if (atCap) return { kind: 'refused', refusal: { kind: 'daily-cap', message: SYSTEM_SENTENCES.dailyCap, resetAt: resetAt(started) } }
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
  return { kind: 'stream', ops: run(input, deps, repo, Boolean(sample), started), notice }
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
  const keep = (composition: Composition) =>
    deps.cache.set(answerKey(repo, input.question, input.from), composition, sample ? null : LIVE_TTL_SECONDS).catch(error => log.warn('answer not cached', { error: (error as Error).message }))

  try {
    const cache = sample ? await primeSampleCache(repo, deps.sampleCache) : deps.cache
    const sampleNow = sample && 'now' in cache ? (cache as { now?: number }).now : undefined

    const tClassify = now()
    const summaryCtx = await buildContext(deps.github, cache, repo, { shapes: ['repo', 'activity'], measures: [] }, { now: sampleNow, offline: sample, ttlSeconds: sample ? null : LIVE_TTL_SECONDS })
    const r = summaryCtx.shapes.repo!
    let route: Classification
    if (deps.eval?.route === 'off-template') route = { template: 'off-template', confidence: 1, params: NO_PARAMS }
    else {
      const classified = await classify(deps.models, {
        question: input.question,
        summary: { repo: `${r.owner}/${r.name}`, language: r.primaryLanguage, stars: r.stars, openPulls: summaryCtx.shapes.activity?.open.pulls ?? null, openIssues: r.openIssues, pushedAt: r.pushedAt },
        ...(input.from ? { from: input.from } : {}),
      })
      route = classified.result
      await spend(classified.usage)
    }
    deps.eval?.onRoute?.(route.template)
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
    deps.eval?.onContext?.(ctx)

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
      const { composition: kept, drops } = enforceRules(composition, { question: input.question })
      deps.eval?.onDrops?.(drops)
      await keep(kept)
      yield* replay({ ...kept, built: { ...kept.built, latencyMs: { ...kept.built.latencyMs, total: now() - started } } })
      return
    }

    // Off-template: each piece streams as soon as the model has written it and it has passed the rules.
    const sofar: Composition = { id, density: 'comfortable', regions: { insight: [], metrics: [], main: [], side: [], action: [] }, asks: [], built: built('off-template', calls, { classifyMs, dataMs, composeMs: 0, started, now }, ctx, []) }
    const queue: StreamOp[] = []
    const drops: RuleDrop[] = []
    let wake: (() => void) | null = null
    const push = (op: StreamOp) => {
      queue.push(op)
      wake?.()
    }
    let started_ = false
    let finished = false
    const composing = composeOffTemplate(deps.models, ctx, input.question, {
      frameWidth: input.frameWidth,
      ...(deps.eval?.offTemplateModel ? { model: deps.eval.offTemplateModel } : {}),
      onOp: op => {
        if (op.op === 'start') {
          sofar.density = op.density
          sofar.asks = op.asks
          return
        }
        if (op.op === 'dropped') return
        const next = { ...sofar, regions: { ...sofar.regions, [op.region]: [...sofar.regions[op.region], op.piece] } }
        const { composition: kept } = enforceRules(next, { question: input.question, log: quiet })
        if (!keptPiece(kept, op.piece)) {
          drops.push({ id: op.piece.id, rule: 'dropped by a composition rule as it arrived' })
          return
        }
        if (!started_) {
          push({ op: 'start', id, density: sofar.density, asks: enforceRules(sofar, { log: quiet }).composition.asks })
          started_ = true
        }
        sofar.regions = next.regions
        push({ op: 'add', region: op.region, piece: op.piece })
      },
    }).finally(() => {
      finished = true
      wake?.()
    })
    while (!finished || queue.length) {
      if (queue.length) yield queue.shift()!
      else await new Promise<void>(resolve => (wake = resolve))
      wake = null
    }
    const result = await composing
    await spend(result.usage)
    deps.eval?.onDrops?.(drops)
    if (!started_) yield { op: 'start', id, density: sofar.density, asks: [] }
    const done: Built = { ...built('off-template', calls, { classifyMs, dataMs, composeMs: now() - tCompose, started, now }, ctx, chose(sofar.regions)), reason: 'no template matched' }
    if (started_) await keep({ ...sofar, built: done })
    yield { op: 'done', built: done }
  } catch (error) {
    log.error('composition failed', { error: (error as Error).message })
    if (error instanceof GitHubError && error.rateLimited) yield { op: 'error', reason: SYSTEM_SENTENCES.rateLimit(timeWords(error.resetAt, input.timeZone)) }
    else yield { op: 'error', reason: SYSTEM_SENTENCES.composeFailed }
  }
}

const quiet = createLogger('composer:compose', { sink: () => {} })

const NO_PARAMS: Classification['params'] = { pr: null, handle: null, branch: null, window: null, day: null, weekday: null, hour: null }

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

/**
 * The `?force=warming` screen: the first checks report GitHub still counting, then the next one hands off to
 * the real composition, as a cold repo does. Nothing is fetched while it counts.
 */
export function forcedWarming(repo: string, previous: WarmingStatus | null | undefined, now = Date.now()): AsyncIterable<StreamOp> | null {
  const attempt = (previous?.attempt ?? 0) + 1
  if (attempt > 2) return null
  const startedAt = previous?.startedAt ?? new Date(now).toISOString()
  const ids = ['contributors', 'participation', 'commit_activity', 'punch_card'] as const
  const status: WarmingStatus = {
    repo,
    phase: 'warming',
    attempt,
    nextCheckMs: (CHECK_SCHEDULE[attempt]! - CHECK_SCHEDULE[attempt - 1]!) * 1000,
    startedAt,
    elapsedMs: now - Date.parse(startedAt),
    stats: ids.map((id, i) => (attempt > 1 && i === 0 ? { id, state: 'ready', landedAt: new Date(now).toISOString() } : { id, state: 'counting' })),
  }
  const b: Built = { template: 'warming', model: 'none', tokens: { input: 0, cached: 0, output: 0 }, costUsd: 0, latencyMs: { classify: 0, data: 0, compose: 0, total: 0 }, githubReads: 0, chose: ['WarmingUp'] }
  return warmingScreen(`cmp-warming-${Date.parse(startedAt).toString(36)}`, { warming: status } as DataContext, b)
}

/**
 * The `?force=empty` screen: the asked question's template, or the overview, composed against one real tiny
 * repo recorded in `fixtures/near-empty/`. Offline and with no model call, so the prose is the system's own.
 */
export async function* forcedEmpty(question: string, timeZone?: string, now: () => number = Date.now): AsyncIterable<StreamOp> {
  const started = now()
  const template = goldenQuestion(question) ?? 'overview'
  let ctx: DataContext
  try {
    ctx = (await nearEmptyContext(needsFor(template), knownZone(timeZone))).ctx
  } catch (error) {
    log.error('near-empty fixture unreadable', { error: (error as Error).message })
    yield { op: 'error', reason: SYSTEM_SENTENCES.composeFailed }
    return
  }
  const dataMs = now() - started
  const screen = TEMPLATES[template]!.compose(ctx, {})
  const lead = nearEmptyInsight(ctx)
  const regionsOf = lead ? { ...screen.regions, insight: [lead] } : screen.regions
  const composeMs = now() - started - dataMs
  const composition: Composition = {
    id: `cmp-empty-${template}`,
    density: screen.density,
    regions: regionsOf,
    asks: screen.asks.slice(0, 4),
    built: built(template, [], { classifyMs: 0, dataMs, composeMs, started, now }, ctx, chose(regionsOf)),
  }
  const { composition: kept } = enforceRules(composition, { question, log: quiet })
  yield* replay({ ...kept, built: { ...kept.built, chose: chose(kept.regions) } })
}

function knownZone(zone: string | undefined): string {
  if (!zone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone })
    return zone
  } catch {
    return 'UTC'
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
