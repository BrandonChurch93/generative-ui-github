import { createLogger } from '@genui-github/core'
import { validateNumbers } from '../../validate/numbers'
import { VERDICT_TONE, VERDICTS, type ComparisonPair, type ComparisonPeriods, type ComparisonProps, type PairUnit, type Verdict } from './schema'

// The system's reading of each pair: the formatted values, the signed delta, the verdict and the tally.
// The model never supplies any of it.

const log = createLogger('ui:comparison')

const MINUS = '−'
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fixedTenth = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const upToTenth = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

/** The mono suffix after a tip value. Percent is not a suffix: it sits on the number. */
export const UNIT_SUFFIX: Record<PairUnit, string> = { count: '', h: 'h', d: 'd', min: 'min', percent: '', ratio: '×' }
const UNIT_WORDS: Record<PairUnit, string> = { count: '', h: 'hours', d: 'days', min: 'minutes', percent: '', ratio: 'times' }

/** A count is whole; a measure under 10 keeps its tenth ("8.0 h"); larger ones drop a trailing zero. */
export function formatPairValue(value: number, unit: PairUnit): string {
  if (unit === 'count') return whole.format(value)
  return Math.abs(value) < 10 ? fixedTenth.format(value) : upToTenth.format(value)
}

/** The value as a reader hears it: "19.6 hours", "4.1%", "214". */
function spoken(value: number, unit: PairUnit, withUnit = true): string {
  const figure = `${formatPairValue(value, unit)}${unit === 'percent' ? '%' : ''}`
  return withUnit && UNIT_WORDS[unit] ? `${figure} ${UNIT_WORDS[unit]}` : figure
}

export interface Delta {
  sign: '+' | typeof MINUS | ''
  magnitude: number
  decimals: 0 | 1
  /** `%` sits on the number; anything else is a mono suffix (`pts`, `h`). */
  unit: string
  /** The sign and the figure: "+38", "−2.2", "0". */
  figure: string
  kind: 'percent' | 'points' | 'absolute' | 'zero'
}

export function formatMagnitude(magnitude: number, decimals: 0 | 1): string {
  return decimals === 0 ? whole.format(magnitude) : upToTenth.format(magnitude)
}

/** Percent for durations and counts (whole, one decimal under 1%), points for rates. A change from zero has no percent, so it prints in the measure's unit. */
export function deltaFor(pair: ComparisonPair): Delta {
  const { current, previous, unit } = pair
  if (current === previous) return { sign: '', magnitude: 0, decimals: 0, unit: '%', figure: '0', kind: 'zero' }
  const sign = current > previous ? '+' : MINUS
  const build = (magnitude: number, decimals: 0 | 1, u: string, kind: Delta['kind']): Delta => ({
    sign,
    magnitude,
    decimals,
    unit: u,
    figure: `${sign}${formatMagnitude(magnitude, decimals)}`,
    kind,
  })
  const diff = Math.abs(current - previous)
  if (unit === 'percent') return build(diff, 1, 'pts', 'points')
  if (previous === 0) return build(diff, unit === 'count' ? 0 : 1, UNIT_SUFFIX[unit], 'absolute')
  const percent = (diff / Math.abs(previous)) * 100
  return build(percent, Math.round(percent * 10) / 10 < 1 ? 1 : 0, '%', 'percent')
}

/** The delta as one string: "+38%", "−2.2 pts", "+3 h". */
export const deltaWords = (d: Delta) => `${d.figure}${d.unit === '%' ? '%' : d.unit ? ` ${d.unit}` : ''}`

/** The change in the measure's own unit, for the tooltip: "+5.4 h", "−2.2 pts", "+28". */
export function absoluteChange(pair: ComparisonPair): { figure: string; unit: string } {
  const { current, previous, unit } = pair
  const sign = current > previous ? '+' : current < previous ? MINUS : ''
  const diff = Math.abs(current - previous)
  return { figure: `${sign}${unit === 'count' ? whole.format(diff) : upToTenth.format(diff)}`, unit: unit === 'percent' ? 'pts' : UNIT_SUFFIX[unit] }
}

/** Up is good or bad by the measure, never by the sign. A pair the model did not mark notable reads steady. */
export function verdictFor(pair: ComparisonPair): Verdict {
  if (pair.current === pair.previous) return 'no change'
  const up = pair.current > pair.previous
  if (pair.direction === 'neutral') return up ? 'higher' : 'lower'
  if (!pair.notable) return 'steady'
  const helps = pair.direction === 'higher-is-better' ? up : !up
  return helps ? 'better' : 'worse'
}

export const toneFor = (pair: ComparisonPair) => VERDICT_TONE[verdictFor(pair)]

/** "2 better · 1 worse · 1 steady", in a fixed order. */
export function tally(pairs: ComparisonPair[], separator = ' · '): string {
  const counts = new Map<Verdict, number>()
  for (const p of pairs) counts.set(verdictFor(p), (counts.get(verdictFor(p)) ?? 0) + 1)
  return VERDICTS.filter(v => counts.has(v))
    .map(v => `${counts.get(v)} ${v}`)
    .join(separator)
}

/** Each bar's length as a share of the larger value in its row, which spans the column less the tip room. */
export function barShares(pair: ComparisonPair): { current: number; previous: number } {
  const top = Math.max(Math.abs(pair.current), Math.abs(pair.previous))
  if (top === 0) return { current: 0, previous: 0 }
  return { current: Math.abs(pair.current) / top, previous: Math.abs(pair.previous) / top }
}

/** What a row reads as text: "19.6 hours in September, 14.2 in August." */
export function rowValues(pair: ComparisonPair, periods: ComparisonPeriods): string {
  return `${spoken(pair.current, pair.unit)} in ${periods.current}, ${spoken(pair.previous, pair.unit, false)} in ${periods.previous}.`
}

/** The whole row as one sentence, for a row that is a button. */
export function rowSentence(pair: ComparisonPair, periods: ComparisonPeriods): string {
  const delta = deltaFor(pair)
  const now = `${pair.name}, ${spoken(pair.current, pair.unit)} in ${periods.current}`
  const before = `${spoken(pair.previous, pair.unit, false)} in ${periods.previous}`
  if (delta.kind === 'zero') return `${now}, no change from ${before}`
  const way = delta.sign === '+' ? 'up' : 'down'
  const by =
    delta.kind === 'points'
      ? `${formatMagnitude(delta.magnitude, 1)} points`
      : delta.kind === 'percent'
        ? `${formatMagnitude(delta.magnitude, delta.decimals)}%`
        : spoken(delta.magnitude, pair.unit)
  return `${now}, ${way} ${by} from ${before}, ${verdictFor(pair)}`
}

/** Every figure the finding may cite: both values, the change in units and in percent, and how many pairs. */
export function comparisonFacts(props: ComparisonProps): number[] {
  return [
    props.pairs.length,
    ...props.pairs.flatMap(p => {
      const diff = Math.abs(p.current - p.previous)
      const facts = [p.current, p.previous, diff]
      if (p.previous !== 0) facts.push((diff / Math.abs(p.previous)) * 100)
      return facts
    }),
  ]
}

/** The figure's label: the model's finding when its numbers check out, else the system's own summary. */
export function comparisonLabel(props: ComparisonProps): string {
  const check = validateNumbers(props.finding, comparisonFacts(props))
  if (check.ok) return props.finding
  log.warn('comparison finding did not match its values', { mismatches: check.mismatches.map(m => m.raw) })
  return `${props.title}, ${props.periods.current} against ${props.periods.previous}: ${tally(props.pairs, ', ')}.`
}
