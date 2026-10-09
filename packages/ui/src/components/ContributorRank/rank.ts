import { RANK_COPY, RANK_WINDOW_WORDS, RANK_WORDS, type ContributorRankProps, type RankPerson } from './schema'

export interface RankRow extends RankPerson {
  /** 1-based, over everyone in the window. */
  rank: number
  /** Of the window's whole total, 0 to 1. */
  share: number
  /** The share as printed, whole percents. */
  percent: number
  /** Count over the top count: the bar's length on the leader's track. */
  frac: number
  /** Whole percent carried by this row and everyone above it: the table view's running total. */
  running: number
  wall: boolean
}

export interface Ranking {
  total: number
  /** The rows shown, in rank order. */
  rows: RankRow[]
  /** The smallest group from the top that carries half the window's total, counting everyone. */
  busFactor: number
  /** Rows above the band: the wall when it fits in view, else every row shown. */
  above: number
  /** The wall fits in the rows shown. Otherwise the card is spread out and nothing is accented. */
  walled: boolean
  risk: boolean
  band: { label: string; sentence: string }
  /** The card's aria-label. */
  finding: string
  /** People left off the card, so the shares on it close to 100%. */
  rest: { people: number; count: number; percent: number; words: string } | null
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const formatCount = (n: number) => whole.format(n)
export const formatPercent = (n: number) => `${Math.round(n)}%`

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** Most work first; a tie goes to whoever was active most recently, so the wall breaks ties the same way. */
export function sortPeople(people: readonly RankPerson[]): RankPerson[] {
  return people
    .filter(p => Number.isFinite(p.count) && p.count > 0)
    .sort((a, b) => b.count - a.count || (b.lastActive ?? '').localeCompare(a.lastActive ?? '') || a.handle.localeCompare(b.handle))
}

export function countWords(n: number, measure: ContributorRankProps['measure'], short = false): string {
  const w = RANK_WORDS[measure]
  return `${formatCount(n)} ${n === 1 ? (short ? w.shortOne : w.unitOne) : short ? w.short : w.unit}`
}

/** Everything the system derives from the people: shares, the wall, the band's words and the finding. */
export function rankPeople(props: ContributorRankProps): Ranking {
  const words = RANK_WORDS[props.measure]
  const sorted = sortPeople(props.people)
  const total = sorted.reduce((sum, p) => sum + p.count, 0)
  const top = sorted[0]?.count ?? 1

  let busFactor = 0
  for (let cum = 0; busFactor < sorted.length && cum * 2 < total; busFactor++) cum += sorted[busFactor]!.count

  const shown = sorted.slice(0, Math.max(1, props.limit))
  const walled = busFactor > 0 && busFactor <= shown.length
  let carried = 0
  const rows: RankRow[] = shown.map((p, i) => {
    carried += p.count
    return {
      ...p,
      rank: i + 1,
      share: total ? p.count / total : 0,
      percent: total ? Math.round((p.count / total) * 100) : 0,
      frac: p.count / top,
      running: total ? Math.round((carried / total) * 100) : 0,
      wall: walled && i < busFactor,
    }
  })

  const above = walled ? busFactor : rows.length
  const aboveCount = rows.slice(0, above).reduce((sum, r) => sum + r.count, 0)
  const abovePercent = total ? Math.round((aboveCount / total) * 100) : 0
  // A wall the data does not show cannot be at risk, whatever the model said.
  const risk = walled && props.wallTone === 'risk'

  const band = walled
    ? {
        label: `Bus factor ${busFactor}`,
        sentence:
          busFactor === 1
            ? `one person carries ${abovePercent}% of ${words.unit}`
            : `these ${inWords(busFactor)} carry ${abovePercent}% of ${words.unit}`,
      }
    : {
        label: `Bus factor above ${rows.length}`,
        sentence: `the top ${inWords(rows.length)} carry ${abovePercent}% of ${words.unit}`,
      }

  const handles = joinNames(rows.slice(0, above).map(r => r.handle))
  const finding = walled
    ? `${busFactor === 1 ? 'one person' : `${inWords(busFactor)} people`}, ${handles}, ${busFactor === 1 ? 'carries' : 'carry'} ${abovePercent}% of ${words.finding} in the ${RANK_WINDOW_WORDS}`
    : `${RANK_COPY.spreadLead}: the top ${inWords(rows.length)} carry ${abovePercent}% of ${words.finding} in the ${RANK_WINDOW_WORDS}`

  const restPeople = sorted.length - rows.length
  const restCount = total - rows.reduce((sum, r) => sum + r.count, 0)
  // The printed shares and this one close to exactly 100, so the card adds up as read.
  const restPercent = Math.max(0, 100 - rows.reduce((sum, r) => sum + r.percent, 0))
  const rest =
    restPeople > 0
      ? {
          people: restPeople,
          count: restCount,
          percent: restPercent,
          words: `${restPeople} more ${restPeople === 1 ? `${words.person} has` : `${words.people} share`} the other ${restPercent}% · ${countWords(restCount, props.measure, true)}`,
        }
      : null

  return {
    total,
    rows,
    busFactor,
    above,
    walled,
    risk,
    band,
    finding: risk ? `${RANK_COPY.riskLead}: ${finding}` : capital(finding),
    rest,
  }
}
