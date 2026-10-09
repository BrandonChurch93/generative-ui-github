import { REGION_NAMES, validateRegions, type Composition, type Piece } from '@genui-github/renderer/core'
import type { EvalCase } from './set'

// The scorers in docs/evals.md. Each takes what the composer did and what the case expects, and says whether
// it passed and, where it is a measure, by how much. Pure, so each has a test.

export interface Score {
  pass: boolean
  /** The figure behind the verdict: F1, a share of bindings, a count. */
  value?: number
  /** Why it failed, in plain words, for the results page. */
  reason?: string
}

/** Not scored for this case: nothing was expected, or the case cannot reach it. */
export const NA = null

export const pieces = (c: Composition): Piece[] => REGION_NAMES.flatMap(r => c.regions[r])

export function scoreTemplate(expected: string, actual: string | undefined): Score {
  return actual === expected ? { pass: true } : { pass: false, reason: `routed to ${actual ?? 'nothing'}, expected ${expected}` }
}

/** F1 between two multisets of component names. */
export function f1(expected: readonly string[], actual: readonly string[]): number {
  if (!expected.length && !actual.length) return 1
  const left = new Map<string, number>()
  for (const e of expected) left.set(e, (left.get(e) ?? 0) + 1)
  let hit = 0
  for (const a of actual) {
    const n = left.get(a) ?? 0
    if (n > 0) {
      hit += 1
      left.set(a, n - 1)
    }
  }
  if (!hit) return 0
  const precision = hit / actual.length
  const recall = hit / expected.length
  return (2 * precision * recall) / (precision + recall)
}

export const COMPONENTS_PASS = 0.85

export function scoreComponents(expected: readonly string[], composition: Composition): Score {
  const actual = pieces(composition).map(p => p.component)
  const value = Number(f1(expected, actual).toFixed(3))
  if (value >= COMPONENTS_PASS) return { pass: true, value }
  const missing = diff(expected, actual)
  const extra = diff(actual, expected)
  return { pass: false, value, reason: [missing.length ? `missing ${missing.join(', ')}` : '', extra.length ? `extra ${extra.join(', ')}` : ''].filter(Boolean).join(' · ') }
}

function diff(a: readonly string[], b: readonly string[]): string[] {
  const left = [...b]
  return a.filter(x => {
    const i = left.indexOf(x)
    if (i < 0) return true
    left.splice(i, 1)
    return false
  })
}

const isHot = (p: Piece) => p.component === 'Metric' && (p.props as { hot?: boolean } | undefined)?.hot === true

export function scoreHot(expected: readonly string[], composition: Composition): Score {
  const actual = pieces(composition).filter(isHot).map(p => p.id).sort()
  const want = [...expected].sort()
  const pass = actual.length === want.length && actual.every((id, i) => id === want[i])
  return pass ? { pass } : { pass, reason: `hot ${actual.join(', ') || 'none'}, expected ${want.join(', ') || 'none'}` }
}

/** Reads a dotted path into the context: `measures.failing-checks.value`. */
export function at(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((v, key) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined), root)
}

/** A measure's value as a piece shows it: a count of a total shows its count, with the total beside it. */
const shown = (v: unknown) => (v && typeof v === 'object' && 'count' in v ? (v as { count: unknown }).count : v)

/** A clock value set as text ("23:00") is the hour the measure holds (23). */
const hourOf = (v: unknown) => (typeof v === 'string' && /^\d{1,2}:00$/.test(v) ? Number(v.slice(0, -3)) : v)

const same = (x: unknown, b: unknown) => {
  const a = typeof b === 'number' ? hourOf(x) : x
  return typeof a === 'number' && typeof b === 'number' ? Math.round(a * 10) === Math.round(b * 10) : a === b || (a == null && b == null)
}

/**
 * Each binding: the piece is on screen and its prop equals the expression evaluated on the context. A piece that
 * is missing fails, since a template that binds the wrong scope or measure changes the piece's id.
 */
export function scoreBindings(
  expected: NonNullable<EvalCase['expect']['bindings']>,
  composition: Composition,
  context: unknown,
  /** A measure over another window, for a piece that asked for one (a Metric with `window: '7d'`). */
  windowed?: (measure: string, window: string) => unknown,
): Score {
  const byId = new Map(pieces(composition).map(p => [p.id, p]))
  const wrong: string[] = []
  let checked = 0
  for (const b of expected) {
    const piece = byId.get(b.id)
    checked += 1
    if (!piece) {
      wrong.push(`${b.id} is not on screen`)
      continue
    }
    const got = at(piece.bound, b.prop)
    const window = (piece.props as { window?: unknown } | undefined)?.window
    const measure = /^measures\.([^.]+)\.value$/.exec(b.equals)?.[1]
    const want = shown(typeof window === 'string' && measure && windowed ? windowed(measure, window) : at(context, b.equals))
    // A piece in its empty, warming or error state over data that is not there is honest, whatever it holds.
    if (piece.state && want == null) continue
    if (!same(got, want)) wrong.push(`${b.id}.${b.prop} is ${String(got)}, ${b.equals} is ${String(want)}`)
  }
  const value = Number(((checked - wrong.length) / checked).toFixed(3))
  return wrong.length ? { pass: false, value, reason: wrong.join(' · ') } : { pass: true, value }
}

export interface RendererFindings {
  /** Unknown components, props that fail their schema, pieces with no data after done. */
  schema: string[]
  /** Prose whose numbers did not match the cited data. */
  numbers: string[]
  /** Pieces the renderer's own copy of the composition rules dropped. */
  rules: string[]
}

const SCHEMA_WARNINGS = ['unknown component', 'props failed the component schema', 'piece has no data after the composition finished']

/** Runs the renderer's validation on the finished composition and sorts what it reported. */
export function rendererFindings(composition: Composition): RendererFindings {
  const found: RendererFindings = { schema: [], numbers: [], rules: [] }
  const log = {
    warn(message: string, fields?: Record<string, unknown>) {
      const id = String(fields?.id ?? '')
      if (SCHEMA_WARNINGS.includes(message)) found.schema.push(`${id} ${message}`)
      else if (message === 'prose number did not match the cited data') found.numbers.push(`${id} ${JSON.stringify(fields?.mismatches ?? [])}`)
      else if (message === 'piece dropped by a composition rule') found.rules.push(`${id} ${String(fields?.rule ?? '')}`)
    },
  }
  validateRegions(composition.regions, { log, final: true, free: composition.built.template === 'off-template' })
  return found
}

export const listScore = (problems: readonly string[]): Score => (problems.length ? { pass: false, value: problems.length, reason: problems.join(' · ') } : { pass: true, value: 0 })
