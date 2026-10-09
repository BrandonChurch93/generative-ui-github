import { CORE_ASSOCIATIONS, isBot, listCoverage, median, mondayOf, percentile, windowSpan, type AuthorAssociation, type Person, type ShapeName } from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import {
  dateWords,
  missingCause,
  WINDOW_WORDS,
} from './group-b-ui'
import { Distribution } from '@genui-github/ui/schemas'

type DistributionMeasure = Distribution.DistributionMeasure
type DistributionModel = Distribution.DistributionModelProps
type DistributionBound = Distribution.DistributionProps
const { BIN_COUNT, binOf, MEASURE_WORDS } = Distribution

const COMPONENT = 'Distribution'
const HOUR = 3_600_000
const DAY = 24 * HOUR
const t = (iso: string) => Date.parse(iso)
/** The spread reads the last 90 days, cut to where the capped lists reach. */
const WINDOW = '90d' as const

const NEEDS: Record<DistributionMeasure, ShapeName[]> = { firstReview: ['pulls'], merge: ['pulls'], issueResponse: ['issues'] }
const FAILED: Record<DistributionMeasure, string> = {
  firstReview: "Couldn't load review times",
  merge: "Couldn't load merge times",
  issueResponse: "Couldn't load issue response times",
}
const FIRST_TIME: ReadonlySet<AuthorAssociation> = new Set(['FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER'])

/** One item measured from `start`; `end` is null while it still waits. */
interface Item {
  start: number
  end: number | null
}

const waitWords = (ms: number) => (ms < HOUR ? 'under 1h' : ms < DAY ? `${Math.floor(ms / HOUR)}h` : `${Math.floor(ms / DAY)}d`)
const earliest = (...times: (string | null)[]) => {
  const valid = times.filter((x): x is string => x !== null).map(t)
  return valid.length ? Math.min(...valid) : null
}

/**
 * First-time is an estimate (docs/questions.md 4.7): GitHub reads the association as it is today, so the test is
 * no commits before the window among the contributor stats' top authors, and never the core team.
 */
function firstTimeTest(ctx: DataContext, from: number): ((person: Person, association?: AuthorAssociation) => boolean) | null {
  const stats = ctx.shapes['stats.contributors']
  if (!stats) return null
  const before = new Set(stats.authors.filter(a => a.weeks.some(w => t(w.weekStart) < mondayOf(from) && w.commits > 0)).map(a => a.author.login))
  return (person, association) => (association !== undefined && FIRST_TIME.has(association)) || (!before.has(person.login) && !(association && CORE_ASSOCIATIONS.has(association)))
}

type Read = { kind: 'items'; items: Item[]; from: number } | { kind: 'error'; failed: string; cause: string }

function read(ctx: DataContext, props: DistributionModel): Read {
  const missing = NEEDS[props.measure].filter(n => !ctx.shapes[n])
  if (missing.length) return { kind: 'error', failed: FAILED[props.measure], cause: missingCause(ctx, missing) }
  const span = windowSpan(WINDOW, ctx.now)
  const { pulls, issues } = ctx.shapes
  const from = Math.max(span.from, props.measure === 'issueResponse' ? listCoverage(undefined, issues) : listCoverage(pulls))
  const inWindow = (iso: string | null) => iso !== null && t(iso) >= from && t(iso) < span.to

  let who: (person: Person, association?: AuthorAssociation) => boolean = () => true
  if (props.population === 'firstTime') {
    const test = firstTimeTest(ctx, from)
    if (test) who = test
    else if (props.measure === 'issueResponse') return { kind: 'error', failed: "Couldn't tell first-time contributors apart", cause: missingCause(ctx, ['stats.contributors']) }
    else who = (_person, association) => association !== undefined && FIRST_TIME.has(association)
  }

  if (props.measure === 'issueResponse') {
    const items = [...issues!.open, ...issues!.closed]
      .filter(i => !isBot(i.author) && inWindow(i.createdAt) && who(i.author))
      .map(i => ({ start: t(i.createdAt), end: earliest(i.firstHumanCommentAt) }))
    return { kind: 'items', items, from }
  }
  const all = [...pulls!.open, ...pulls!.merged].filter(p => !isBot(p.author) && who(p.author, p.authorAssociation))
  const items =
    props.measure === 'firstReview'
      ? all.filter(p => inWindow(p.createdAt)).map(p => ({ start: t(p.createdAt), end: earliest(p.firstHumanReviewAt, p.firstHumanCommentAt, p.mergedAt) }))
      : [
          ...all.filter(p => p.mergedAt !== null && inWindow(p.mergedAt)).map(p => ({ start: t(p.createdAt), end: t(p.mergedAt!) })),
          ...pulls!.open.filter(p => !isBot(p.author) && who(p.author, p.authorAssociation) && inWindow(p.createdAt)).map(p => ({ start: t(p.createdAt), end: null })),
        ]
  return { kind: 'items', items, from }
}

export const bindDistribution: Binder<DistributionModel> = (ctx, props, extras) => {
  const span = windowSpan(WINDOW, ctx.now)
  const got = read(ctx, props)
  const cut = got.kind === 'items' && got.from > span.from
  const base: DistributionBound = {
    ...props,
    // A model's meta names the window it asked for; when the lists stop short of it, the system says where they start.
    meta: cut ? `since ${dateWords(got.from)}` : (props.meta ?? WINDOW_WORDS[WINDOW]),
    perspective: props.perspective ?? 'reader',
    counts: Array.from({ length: BIN_COUNT }, () => 0),
    medianMinutes: 0,
    p90Minutes: 0,
  }
  if (got.kind === 'error') return unavailable(COMPONENT, props, base, { failed: got.failed, cause: got.cause }, extras)

  const minutes = got.items.flatMap(i => (i.end === null ? [] : [Math.max(0, i.end - i.start) / 60_000]))
  const waiting = got.items.filter(i => i.end === null)
  if (!minutes.length) {
    const oldest = Math.max(0, ...waiting.map(i => ctx.now - i.start))
    const verb = props.measure === 'merge' ? 'still open' : 'still waiting'
    return empty(
      COMPONENT,
      props,
      {
        ...base,
        emptyTone: props.emptyTone ?? 'neutral',
        empty: props.empty ?? MEASURE_WORDS[props.measure].empty[props.population],
        ...(waiting.length ? { emptyMeta: `${waiting.length} ${verb} · oldest waiting ${waitWords(oldest)}` } : {}),
      },
      extras,
    )
  }
  const counts = base.counts.slice()
  for (const m of minutes) counts[binOf(m)]! += 1
  return bound(COMPONENT, props, { ...base, counts, medianMinutes: median(minutes)!, p90Minutes: percentile(minutes, 90)! }, extras)
}
