// Every number the model writes in prose must appear, within rounding, in the data the piece cites.
// A sentence that fails is never rendered; the system sentence takes its place.

export interface ProseNumber {
  /** As written: "19.6", "1,234", "38%", "three", "#84120". */
  raw: string
  value: number
  /** Digits after the point as written; rounding is checked to this precision. */
  decimals: number
  percent: boolean
  /** A pull request or issue number. */
  reference: boolean
}

export interface NumberCheck {
  ok: boolean
  checked: ProseNumber[]
  mismatches: ProseNumber[]
}

const SPELLED: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
}

/** The model's phrasing for "one", which is an article as often as a number. */
const ARTICLE_LIKE = new Set(['one'])

// Identifiers in backticks, versions (v16.2, 15.5.0), and percentile names (p50, p90) are names, not figures.
const IGNORED = /`[^`]*`|\bv\d+(?:\.\d+)*\b|\b\d+\.\d+\.\d+\b|\bp\d{2}\b/gi
const FIGURE = /(#)?(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\s?%)?/g
const WORD = /\b([a-z]+)\b/gi

export function extractNumbers(text: string): ProseNumber[] {
  const masked = text.replace(IGNORED, m => ' '.repeat(m.length))
  const found: (ProseNumber & { at: number })[] = []
  for (const m of masked.matchAll(FIGURE)) {
    const [raw, hash, whole, fraction, percent] = m
    found.push({
      at: m.index ?? 0,
      raw: raw.trim(),
      value: Number(`${whole!.replace(/,/g, '')}${fraction ? `.${fraction}` : ''}`),
      decimals: fraction?.length ?? 0,
      percent: Boolean(percent),
      reference: Boolean(hash),
    })
  }
  for (const m of masked.matchAll(WORD)) {
    const word = m[1]!.toLowerCase()
    if (!(word in SPELLED) || ARTICLE_LIKE.has(word)) continue
    found.push({ at: m.index ?? 0, raw: m[1]!, value: SPELLED[word]!, decimals: 0, percent: false, reference: false })
  }
  return found.sort((a, b) => a.at - b.at).map(({ at: _at, ...n }) => n)
}

const round = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals

export interface NumberOptions {
  /**
   * The data is a ratio drawn in × (closed per opened): "57%" must not pass for 0.57×, or the sentence and
   * the chart beside it would name one value in two units. A percent change ("fell 18%") still matches.
   */
  ratio?: boolean
}

function matches(n: ProseNumber, value: number, options: NumberOptions): boolean {
  const v = Math.abs(value)
  if (round(v, n.decimals) === n.value) return true
  // "38%" may cite a share stored as 0.38.
  if (!options.ratio && n.percent && v <= 1 && round(v * 100, n.decimals) === n.value) return true
  return false
}

/** Checks every number in `text` against the numbers the piece cites. */
export function validateNumbers(text: string, allowed: Iterable<number>, options: NumberOptions = {}): NumberCheck {
  const pool = [...allowed].filter(Number.isFinite)
  const checked = extractNumbers(text)
  const mismatches = checked.filter(n => !pool.some(v => matches(n, v, options)))
  return { ok: mismatches.length === 0, checked, mismatches }
}

/** The system sentence that replaces prose whose numbers do not match its data. */
export const NUMBER_MISMATCH_SENTENCE = "The model's figure didn't match the data. Here is what the data shows."

/**
 * The figures a sentence about a series may cite beyond its points: how many weeks, and the change from
 * the first point to the last, absolute and in percent ("39% slower in 12 weeks").
 */
export function seriesFacts(points: readonly (number | null | undefined)[]): number[] {
  const values = points.filter((p): p is number => typeof p === 'number' && Number.isFinite(p))
  if (!values.length) return [points.length]
  const first = values[0]!
  const last = values.at(-1)!
  const facts = [...values, points.length, Math.abs(last - first), Math.min(...values), Math.max(...values)]
  if (first !== 0) facts.push(Math.abs(((last - first) / first) * 100))
  if (last !== 0) facts.push(Math.abs(((first - last) / last) * 100))
  return facts
}
