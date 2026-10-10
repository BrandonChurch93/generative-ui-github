import { CHOREOGRAPHY } from '@genui-github/ui/motion'
import { REGION_NAMES, type RegionName } from './format'
import type { Diff, DiffEntry } from './diff'

// When each piece moves, from design-system/motion.md (Entrance, Rewrite, Update). Seconds, as GSAP takes them.

/** `leave`: the piece runs its exit but stays mounted, until the next answer says whether it stays. */
export type CueAction = 'enter' | 'exit' | 'morph' | 'update' | 'keep' | 'leave'

export interface Cue {
  action: CueAction
  /** Seconds after the screen's clock starts. */
  at: number
}

export interface Plan {
  mode: Diff['mode']
  cues: Map<string, Cue>
  /** When the question in the header wipes, if it changed. */
  question?: { at: number }
  /** The exits a leave started keep running into this change instead of jumping to their end. */
  carry?: boolean
  /** Which leave this change belongs to, so a piece reports its exit to the right one. */
  leave?: number
}

/** Each region starts this long after the one above. The middle of motion.md's 160 to 200ms. */
export const REGION_STAGGER = (CHOREOGRAPHY.regionStagger.min + CHOREOGRAPHY.regionStagger.max) / 2
/** Metrics rise left to right, this far apart; a second piece stacked in a column follows the first the same way. */
export const PIECE_STAGGER = CHOREOGRAPHY.metricStagger
/**
 * In a rewrite, a region's exits run this far ahead of its entrances: long enough that a leaving card has
 * mostly gone before the card taking its place rises, since both stand in the same spot.
 */
export const EXIT_LEAD = 0.3
/** A card's insides start after its rise has begun, so the rise reads first. */
export const INSIDE_DELAY = 0.15

/**
 * The renderer's clock starts at the insight, so the answer is the first thing to arrive. The shell's chrome
 * (eyebrow, built block, question chips) is outside it.
 */
const regionStart = (region: RegionName) => REGION_NAMES.indexOf(region) * REGION_STAGGER
const slot = (entry: DiffEntry) => regionStart(entry.region) + entry.index * PIECE_STAGGER

export interface PlanOptions {
  questionChanged?: boolean
  /**
   * Seconds since a leave started this rewrite's exits, when the question was asked. The rewrite keeps that
   * clock: what has not arrived late enters on the same beat it would have, and what is late enters at once.
   */
  since?: number
}

export function plan(d: Diff, options: PlanOptions = {}): Plan {
  const cues = new Map<string, Cue>()
  const { since } = options
  if (since !== undefined) {
    const wait = Math.max(0, EXIT_LEAD - since)
    for (const e of d.exit) cues.set(e.id, { action: 'exit', at: Math.max(0, slot(e) - since) })
    // A survivor whose exit has begun plays it back first, which takes as long as it has run.
    for (const e of d.morph) cues.set(e.id, { action: 'morph', at: Math.abs(slot(e) - since) })
    for (const e of d.enter) cues.set(e.id, { action: 'enter', at: slot(e) + wait })
    for (const e of d.keep) cues.set(e.id, { action: 'keep', at: 0 })
    return { mode: 'rewrite', cues, carry: true, ...(options.questionChanged ? { question: { at: 0 } } : {}) }
  }
  if (d.mode === 'update') {
    for (const e of d.morph) cues.set(e.id, { action: 'update', at: 0 })
    for (const e of d.enter) cues.set(e.id, { action: 'enter', at: 0 })
    for (const e of d.exit) cues.set(e.id, { action: 'exit', at: 0 })
  } else {
    const lead = d.mode === 'rewrite' && d.exit.length ? EXIT_LEAD : 0
    for (const e of d.exit) cues.set(e.id, { action: 'exit', at: slot(e) })
    for (const e of d.morph) cues.set(e.id, { action: 'morph', at: slot(e) })
    for (const e of d.enter) cues.set(e.id, { action: 'enter', at: slot(e) + lead })
  }
  for (const e of d.keep) cues.set(e.id, { action: 'keep', at: 0 })
  return { mode: d.mode, cues, ...(options.questionChanged ? { question: { at: 0 } } : {}) }
}

/**
 * The first half of a rewrite, started the moment a question is asked and before its answer exists: every
 * piece runs its exit on the rewrite's own beat. The piece the reader clicked stays put, since the next answer
 * is about it and is the likeliest to keep it.
 */
export function leave(d: Diff, options: { anchor?: string; token: number }): Plan {
  const cues = new Map<string, Cue>()
  for (const e of d.exit) cues.set(e.id, e.id === options.anchor ? { action: 'keep', at: 0 } : { action: 'leave', at: slot(e) })
  return { mode: 'rewrite', cues, leave: options.token }
}
