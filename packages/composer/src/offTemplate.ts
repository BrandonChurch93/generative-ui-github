import { z } from 'zod'
import { createLogger, MODELS, type ModelId } from '@genui-github/core'
import { askSchema, densitySchema, emphasisSchema, REGION_NAMES, toneSchema, type Ask, type Density, type Piece, type RegionName, type Regions } from '@genui-github/renderer/core'
import { registry } from '@genui-github/ui/registry'
import releaseBlockers from '@genui-github/renderer/fixtures/1-release-blockers.json' with { type: 'json' }
import checkFailures from '@genui-github/renderer/fixtures/2-check-failures.json' with { type: 'json' }
import contributors from '@genui-github/renderer/fixtures/3-contributors.json' with { type: 'json' }
import type { CallUsage, ModelClient } from './anthropic'
import { BINDERS } from './bind'
import { checkedProse, systemInsightFor } from './prose'
import type { DataContext } from './bind/types'
import { regions as emptyRegions } from './templates/template'

// Off-template composition (docs/composer.md): Sonnet chooses components and their model props as JSONL;
// the system derives ids, validates, binds the data and applies the rules. The model never sees a number it
// did not get from the data, and never writes one the binders do not check.

const log = createLogger('composer:off-template')

/** The composition rules, as docs/composer.md writes them. */
const RULES = `1. The Insight is always the first piece and always cites \`sources\`.
2. At most four Metrics; at most two \`hot\`.
3. At most one ActionCard; always the last piece; left out when there is nothing worth doing.
4. \`main\` and \`side\` are two columns. Each column holds one piece, or a stack of two when the second is \`fixed\` or \`plot\`. Two \`grows\` pieces never share a row; a second \`grows\` stacks below the first in \`main\`. A FilterChips may sit above its \`grows\` target in the same column. A chart beside a \`grows\` list is the common pairing.
5. A Metric never repeats a ContributorRank band's words or a Comparison verdict.
6. A Steps \`ask\` never recomposes a list already on screen.
7. Two categorical series at most on any chart; failures go in the LineChart strip.
8. Every number in prose appears in the cited data. A violation replaces the prose with the system sentence.
9. Density: \`compact\` when the question asks for a quick or short answer; \`spacious\` when it asks to walk through or explain; else \`comfortable\`.
10. Follow-up \`asks\`: zero to four, phrased as a person would type, each answerable by a template.`

const REGIONS = `Regions, top to bottom: insight (exactly one Insight), metrics (zero to four Metric), main and side (two columns: the primary card on the left, a secondary card on the right), action (zero or one ActionCard).
Height classes: fixed (a card of known height), grows (a list that grows with its rows), plot (a chart). Pair a grows list in main with a plot or fixed card in side.`

const FORMAT = `Output JSONL only, one JSON object per line, nothing else:
{"op":"start","density":"comfortable","asks":[{"label":"CI speed","ask":"Is CI getting slower?"}]}
{"op":"add","region":"insight","piece":{"component":"Insight","props":{...}}}
{"op":"add","region":"metrics","piece":{"component":"Metric","props":{...},"ask":"optional follow-up question"}}
...
{"op":"done"}
A piece is {component, props, ask?, emphasis?, tone?}. Props follow the component's signature exactly; the system fills every number, list and label from the data.
Prose is checked figure by figure against the piece's own data, and anything that fails is replaced by the system's sentence:
- The Insight sentence: at most 120 characters, one or two short sentences, using only figures of the measures named in its sources.
- A Metric delta: at most 32 characters, using only figures of that same measure, or left out.
- A chart's finding: only figures from that chart's own series.
Prefer fewer figures to a borrowed one.`

type FixtureLike = { density: string; asks: unknown[]; regions: Record<string, { component: string; props: unknown; ask?: string; emphasis?: string; tone?: string }[]> }

/** A fixture composition as the model would write it: its choices only, no ids, no bound data. */
function example(title: string, question: string, fixture: FixtureLike): string {
  const lines = [
    JSON.stringify({ op: 'start', density: fixture.density, asks: fixture.asks }),
    ...REGION_NAMES.flatMap(region =>
      (fixture.regions[region] ?? []).map(p =>
        JSON.stringify({ op: 'add', region, piece: { component: p.component, props: p.props, ...(p.ask ? { ask: p.ask } : {}), ...(p.emphasis ? { emphasis: p.emphasis } : {}), ...(p.tone ? { tone: p.tone } : {}) } }),
      ),
    ),
    JSON.stringify({ op: 'done' }),
  ]
  return `Example · ${title} · "${question}"\n${lines.join('\n')}`
}

let cachedSystem: string | undefined

/** The cached block: role, registry, rules, regions, format and three worked examples. The same bytes every call. */
export function offTemplateSystem(): string {
  cachedSystem ??= [
    'You compose an interface from a catalog to answer a question about a GitHub repo. You output JSONL messages. You never output HTML, CSS, colors or sizes.',
    registry.toPrompt(),
    `# Composition rules\n${RULES}`,
    `# Regions\n${REGIONS}`,
    `# Output\n${FORMAT}`,
    `# Examples\n${[
      example('release blockers', "What's blocking the next release?", releaseBlockers as FixtureLike),
      example('check failures', 'Which checks are failing on canary?', checkFailures as FixtureLike),
      example('contributors', "Who's carrying this repo?", contributors as FixtureLike),
    ].join('\n\n')}`,
  ].join('\n\n')
  return cachedSystem
}

const lineSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('start'), density: densitySchema, asks: z.array(askSchema).max(4) }),
  z.object({
    op: z.literal('add'),
    region: z.enum(REGION_NAMES),
    piece: z.object({ component: z.string().min(1), props: z.unknown(), ask: z.string().min(1).max(160).optional(), emphasis: emphasisSchema.optional(), tone: toneSchema.optional() }),
  }),
  z.object({ op: z.literal('done') }),
])

export type ComposedOp = { op: 'start'; density: Density; asks: Ask[] } | { op: 'add'; region: RegionName; piece: Piece } | { op: 'dropped'; component: string; reason: string }

/**
 * One line the model wrote, to what the system streams: a bound piece, or a dropped one with why. An unknown
 * component or props that fail the schema still bind to an error piece the renderer draws; a piece whose data
 * is not in this answer is dropped rather than shown failing.
 */
export function bindLine(ctx: DataContext, line: string): ComposedOp | null {
  let json: unknown
  try {
    json = JSON.parse(line)
  } catch {
    if (line.trim()) log.warn('model wrote a line that is not JSON', { line: line.slice(0, 120) })
    return null
  }
  const parsed = lineSchema.safeParse(json)
  if (!parsed.success) {
    log.warn('model wrote a line that is not an op', { issue: parsed.error.issues[0]?.message })
    return null
  }
  const op = parsed.data
  if (op.op === 'done') return null
  if (op.op === 'start') return op
  const { component, props, ask, emphasis, tone } = op.piece
  const spec = registry.get(component)
  const binder = BINDERS[component] as ((c: DataContext, p: unknown, e?: object) => Piece) | undefined
  if (!spec?.pickable || !binder) return { op: 'add', region: op.region, piece: { id: `${component.toLowerCase()}:unknown`, component, props } }
  if (!spec.schema.safeParse(props).success) {
    // Rule 1 needs an answer on screen: an insight the schema refuses (too long, no sources) becomes the system's.
    if (component === 'Insight') return { op: 'add', region: op.region, piece: systemInsightFor(ctx, props, tone) }
    return { op: 'add', region: op.region, piece: { id: registry.deriveId(component, props), component, props } }
  }
  const piece = checkedProse(ctx, binder(ctx, props, { ask, emphasis, tone })).piece
  if (piece.state === 'error') {
    log.info('piece dropped: its data is not in this answer', { component, cause: piece.error?.cause })
    return { op: 'dropped', component, reason: piece.error?.cause ?? 'no data' }
  }
  return { op: 'add', region: op.region, piece }
}

export interface OffTemplateResult {
  density: Density
  asks: Ask[]
  regions: Regions
  dropped: { component: string; reason: string }[]
  /** What the model wrote, as written: recorded so a test can replay the binding without a model call. */
  raw: string
  usage: CallUsage
  stopReason: string | null
}

/** The user turn: the question and the data, pruned to what the context holds for it. */
export function offTemplateUser(question: string, ctx: DataContext, frameWidth?: number): string {
  return [`Question: ${question}`, `Repo: ${ctx.repo.owner}/${ctx.repo.name}`, ...(frameWidth ? [`Frame width: ${frameWidth}px`] : []), `Data: ${JSON.stringify(ctx.view)}`].join('\n')
}

/**
 * Streams Sonnet's composition. `onOp` sees each piece as soon as its line is complete, so the route can stream
 * it on; the result is the whole composition once the model is done.
 */
export async function composeOffTemplate(
  client: ModelClient,
  ctx: DataContext,
  question: string,
  options: { onOp?: (op: ComposedOp) => void; frameWidth?: number; signal?: AbortSignal; model?: ModelId } = {},
): Promise<OffTemplateResult> {
  const { text, done } = client.stream({
    model: options.model ?? MODELS.sonnet,
    cachedSystem: offTemplateSystem(),
    user: offTemplateUser(question, ctx, options.frameWidth),
    maxTokens: 8000,
    effort: 'medium',
    signal: options.signal,
  })
  const result: Omit<OffTemplateResult, 'usage' | 'stopReason'> = { density: 'comfortable', asks: [], regions: emptyRegions({}), dropped: [], raw: '' }
  const take = (op: ComposedOp | null) => {
    if (!op) return
    if (op.op === 'start') Object.assign(result, { density: op.density, asks: op.asks })
    else if (op.op === 'dropped') result.dropped.push({ component: op.component, reason: op.reason })
    else result.regions[op.region] = [...result.regions[op.region], op.piece]
    options.onOp?.(op)
  }
  let buffer = ''
  for await (const chunk of text) {
    buffer += chunk
    result.raw += chunk
    let nl = buffer.indexOf('\n')
    while (nl >= 0) {
      take(bindLine(ctx, buffer.slice(0, nl)))
      buffer = buffer.slice(nl + 1)
      nl = buffer.indexOf('\n')
    }
  }
  take(bindLine(ctx, buffer))
  const { usage, stopReason } = await done
  return { ...result, usage, stopReason }
}

/** A recorded composition replayed through the same binding, for tests: what Sonnet wrote, bound again. */
export function replayOffTemplate(ctx: DataContext, raw: string): Omit<OffTemplateResult, 'usage' | 'stopReason'> {
  const result: Omit<OffTemplateResult, 'usage' | 'stopReason'> = { density: 'comfortable', asks: [], regions: emptyRegions({}), dropped: [], raw }
  for (const line of raw.split('\n')) {
    const op = bindLine(ctx, line)
    if (!op) continue
    if (op.op === 'start') Object.assign(result, { density: op.density, asks: op.asks })
    else if (op.op === 'dropped') result.dropped.push({ component: op.component, reason: op.reason })
    else result.regions[op.region] = [...result.regions[op.region], op.piece]
  }
  return result
}
