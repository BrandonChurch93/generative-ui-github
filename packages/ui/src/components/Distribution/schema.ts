import { z } from 'zod'
import { niceScale, type Scale } from '../../charts/scale'
import type { ComponentSpec } from '../../registry'
import { emptyToneSchema, prose } from '../../schema/shared'
import type { EmptyTone } from '../../types'

export const DISTRIBUTION_MEASURES = ['firstReview', 'merge', 'issueResponse'] as const
export type DistributionMeasure = (typeof DISTRIBUTION_MEASURES)[number]
export type Population = 'firstTime' | 'all'
export type Perspective = 'reader' | 'neutral'

export const distributionSchema = z
  .object({
    title: z.string().min(1).max(48),
    meta: z.string().min(1).max(40).optional(),
    measure: z.enum(DISTRIBUTION_MEASURES),
    population: z.enum(['firstTime', 'all']),
    /** `reader` by default; `neutral` when the question is about the repo rather than the asker's own wait. */
    perspective: z.enum(['reader', 'neutral']).optional(),
    /** True by default. */
    showP90: z.boolean().optional(),
    emptyTone: emptyToneSchema.optional(),
    empty: prose(60).optional(),
  })
  .strict()

export type DistributionModelProps = z.infer<typeof distributionSchema>

export interface DistributionProps {
  title: string
  meta?: string
  measure: DistributionMeasure
  population: Population
  perspective?: Perspective
  showP90?: boolean
  emptyTone?: EmptyTone
  empty?: string
  /** (system) Items per bin of `BIN_LADDER`, fastest first: always seven counts. */
  counts: number[]
  /** (system) The median of the raw durations in minutes, never derived from the bins. */
  medianMinutes: number
  /** (system) The 90th percentile of the raw durations in minutes. */
  p90Minutes: number
  /** (system) The empty row's second line, such as what is still open. */
  emptyMeta?: string
}

/** One fixed ladder, so the same question always draws the same axis. Upper edges in minutes. */
export const BIN_EDGES = [60, 240, 720, 1440, 4320, 10080] as const
export const EDGE_LABELS = ['1h', '4h', '12h', '24h', '3d', '7d'] as const
export const BIN_SHORT = ['under 1h', '1 to 4h', '4 to 12h', '12 to 24h', '1 to 3d', '3 to 7d', 'over 7d'] as const
export const BIN_LONG = ['under 1 hour', '1 to 4 hours', '4 to 12 hours', '12 to 24 hours', '1 to 3 days', '3 to 7 days', 'over 7 days'] as const
export const BIN_COUNT = BIN_SHORT.length

/** Zero-based with three round intervals, so two gridlines sit under the ceiling. Counts are whole, so steps are too. */
export function countScale(maxCount: number): Scale {
  const step = Math.max(1, Math.ceil(niceScale(maxCount, 3).step))
  return { max: step * 3, step, ticks: [0, step, step * 2, step * 3] }
}

/** The bin a raw duration falls in. A value on an edge belongs to the bin above it. */
export const binOf = (minutes: number) => BIN_EDGES.filter(edge => minutes >= edge).length

interface MeasureWords {
  one: string
  many: string
  /** "22 PRs reviewed in 1 to 4 hours" */
  verb: string
  /** "17 PRs waited over 7 days" */
  tail: string
  /** The finding's first sentence, after "Half of ...". */
  half: string
  /** The finding's second sentence, after "1 in 10 ...". */
  slow: string
  table: string
  /** Who the finding counts when the population is first-time contributors. */
  firstTime: string
  botsExcluded: boolean
  /** The empty sentence when the model sent none, by population. */
  empty: Record<Population, string>
}

export const MEASURE_WORDS: Record<DistributionMeasure, MeasureWords> = {
  firstReview: {
    one: 'PR',
    many: 'PRs',
    verb: 'reviewed',
    tail: 'waited',
    half: 'got a first review within',
    slow: 'waited more than',
    table: 'Wait',
    firstTime: 'first-time contributors',
    botsExcluded: true,
    empty: { firstTime: 'No first-time contributor PRs reviewed yet', all: 'No PRs reviewed yet' },
  },
  merge: {
    one: 'PR',
    many: 'PRs',
    verb: 'merged',
    tail: 'took',
    half: 'merged within',
    slow: 'took more than',
    table: 'Time to merge',
    firstTime: 'PRs by first-time contributors',
    botsExcluded: false,
    empty: { firstTime: 'No first-time contributor PRs merged yet', all: 'No PRs merged yet' },
  },
  issueResponse: {
    one: 'issue',
    many: 'issues',
    verb: 'answered',
    tail: 'waited',
    half: 'got a first response within',
    slow: 'waited more than',
    table: 'Wait',
    firstTime: 'issues from first-time contributors',
    botsExcluded: true,
    empty: { firstTime: 'No first-time contributor issues answered yet', all: 'No issues answered yet' },
  },
}

export const MARKER_WORDS = { reader: { wide: 'You would wait here', narrow: 'Your wait' }, neutral: { wide: 'Median', narrow: 'Median' } } as const

export type DurationUnit = 'min' | 'h' | 'd'

/** Minutes under an hour, hours under two days, days after that; always rounded, so the label says "about". */
export function roundDuration(minutes: number): { value: number; unit: DurationUnit } {
  const m = Math.max(1, Math.round(minutes))
  if (m < 60) return { value: m, unit: 'min' }
  const h = Math.round(m / 60)
  if (h < 48) return { value: h, unit: 'h' }
  return { value: Math.round(m / 1440), unit: 'd' }
}

const UNIT_SHORT: Record<DurationUnit, string> = { min: ' min', h: 'h', d: 'd' }
const UNIT_LONG: Record<DurationUnit, [string, string]> = { min: ['minute', 'minutes'], h: ['hour', 'hours'], d: ['day', 'days'] }

export const shortDuration = ({ value, unit }: { value: number; unit: DurationUnit }) => `${Math.round(value)}${UNIT_SHORT[unit]}`
export const longDuration = ({ value, unit }: { value: number; unit: DurationUnit }) =>
  `${value} ${UNIT_LONG[unit][value === 1 ? 0 : 1]}`

export const itemWord = (measure: DistributionMeasure, n: number) => (n === 1 ? MEASURE_WORDS[measure].one : MEASURE_WORDS[measure].many)

/** The figure's label: the finding in words, written by the system from the raw median and p90. */
export function findingSentence(props: Pick<DistributionProps, 'measure' | 'population' | 'medianMinutes' | 'p90Minutes'>): string {
  const words = MEASURE_WORDS[props.measure]
  const who = props.population === 'firstTime' ? words.firstTime : words.many
  const median = longDuration(roundDuration(props.medianMinutes))
  const p90 = longDuration(roundDuration(props.p90Minutes))
  return `Half of ${who} ${words.half} ${median}. 1 in 10 ${words.slow} ${p90}.`
}

/** "22 PRs reviewed in under 1 hour" · "17 PRs waited over 7 days" */
export function binSentence(measure: DistributionMeasure, bin: number, count: number): string {
  const words = MEASURE_WORDS[measure]
  const last = bin === BIN_COUNT - 1
  return `${count} ${itemWord(measure, count)} ${last ? words.tail : `${words.verb} in`} ${BIN_LONG[bin]}`
}

export function shareWords(count: number, total: number): string {
  if (total === 0) return '0%'
  const share = (count / total) * 100
  if (share > 0 && share < 1) return 'under 1%'
  return `${Math.round(share)}%`
}

export function sourceLine(props: DistributionProps, total: number, wide: boolean): string {
  const words = MEASURE_WORDS[props.measure]
  const items = `from ${total} ${itemWord(props.measure, total)}`
  if (!wide && props.showP90 !== false) return `90% ${words.verb} by ${shortDuration(roundDuration(props.p90Minutes))} · ${items}`
  const who = props.population === 'firstTime' ? ' by first-time contributors' : ''
  return `${items}${who}${words.botsExcluded ? ' · bots excluded' : ''}`
}

export const distributionSpec: ComponentSpec<typeof distributionSchema> = {
  name: 'Distribution',
  schema: distributionSchema,
  when: 'How long something takes here, as a spread. Reader perspective for newcomer questions.',
  heightClass: 'plot',
  pickable: true,
  id: { key: p => `${p.measure}:${p.population}` },
  example: {
    title: 'Time to first review',
    meta: 'last 90 days',
    measure: 'firstReview',
    population: 'firstTime',
  },
}
