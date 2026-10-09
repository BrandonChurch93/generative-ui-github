import { CHOREOGRAPHY } from '@genui-github/ui/motion'
import { REGION_NAMES, type RegionName } from './format'
import type { Diff, DiffEntry } from './diff'

// When each piece moves, from design-system/motion.md (Entrance, Rewrite, Update). Seconds, as GSAP takes them.

export type CueAction = 'enter' | 'exit' | 'morph' | 'update' | 'keep'

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

export function plan(d: Diff, options: { questionChanged?: boolean } = {}): Plan {
  const cues = new Map<string, Cue>()
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
