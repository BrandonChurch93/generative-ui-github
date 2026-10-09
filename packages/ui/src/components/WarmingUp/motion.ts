import { gsap } from 'gsap'
import {
  CHOREOGRAPHY,
  count,
  EASE,
  extend,
  fade,
  MOVES,
  one,
  prefersReducedMotion,
  rise,
  slide,
  within,
  wipe,
  type MoveOptions,
  type PieceMotion,
} from '../../motion'
import { LAST_CHECK } from './lanes'
import type { WarmingUpProps } from './schema'

/** The lines under the sentence follow it in. */
const LEAD_FOLLOW = 0.12
const CARD_AT = CHOREOGRAPHY.regionStagger.min
/** Rows have landed once the card has risen; tracks extend from there. */
const TRACKS_AT = CARD_AT + MOVES.slide.in * 0.5
const SETTLE = 0.3
const HEAD_SWAP = 0.2

const isReduced = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()
const leadLines = (root: HTMLElement) => within(root, '[data-why], [data-when]')
const rowsOf = (root: HTMLElement) => within(root, '[data-row]')
const countingTracks = (root: HTMLElement) => within(root, '[data-row]:not([data-settled]) [data-track]')
const heads = (root: HTMLElement) => within(root, '[data-lane] [data-mark]')
const row = (root: HTMLElement, id: string) => one(root, `[data-row="${id}"]`)
const share = (p: WarmingUpProps) => (p.stats.length ? p.stats.filter(s => s.state === 'ready').length / p.stats.length : 0)
const readyCount = (p: WarmingUpProps) => p.stats.filter(s => s.state === 'ready').length

/**
 * The clock: every counting line extends at a constant rate in real time with its head riding the end. Linear,
 * because it is a clock; the one continuous motion in the system. Reduced, the lines step at each check instead.
 */
export function runClock(root: HTMLElement, fromSeconds: number, options: MoveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (isReduced(options)) {
    gsap.set(root, { '--clock': fromSeconds })
    const lanes = within(root, '[data-lane][data-counting]')
    if (lanes.length) tl.add(fade(lanes))
    return tl
  }
  tl.fromTo(
    root,
    { '--clock': fromSeconds },
    { '--clock': LAST_CHECK, duration: Math.max(0, LAST_CHECK - fromSeconds), ease: EASE.clock },
  )
  return tl
}

/** The axis doubles: gridlines and labels slide to their new places and every line shortens in place. */
export function rescale(root: HTMLElement, fromMax: number, toMax: number, options: MoveOptions = {}): gsap.core.Timeline {
  if (isReduced(options)) {
    gsap.set(root, { '--max': toMax })
    return fade(within(root, '[data-lane], [data-gridline], [data-tick]'))
  }
  const tl = gsap.timeline()
  tl.fromTo(root, { '--max': fromMax }, { '--max': toMax, duration: MOVES.extend.in, ease: MOVES.extend.ease })
  return tl
}

function settleLane(root: HTMLElement, id: string, options: MoveOptions, tl: gsap.core.Timeline) {
  const r = row(root, id)
  if (!r) return
  const head = one(r, '[data-lane] [data-mark]')
  if (head) tl.add(fade(head), 0)
  const track = one(r, '[data-track]')
  if (track) tl.add(gsap.fromTo(track, { scaleX: 1, transformOrigin: 'left center' }, { scaleX: 0, duration: MOVES.extend.out, ease: EASE.exit }), 0)
  const segs = within(r, '[data-seg]')
  const from = getComputedStyle(root).getPropertyValue('--accent').trim()
  const to = segs[0] ? getComputedStyle(segs[0]).backgroundColor : ''
  if (segs.length && from && to && !isReduced(options)) {
    tl.add(gsap.fromTo(segs, { backgroundColor: from }, { backgroundColor: to, duration: SETTLE, ease: EASE.travel, clearProps: 'backgroundColor' }), 0)
  }
  const status = one(r, '[data-status]')
  if (status) tl.add(wipe(status, options), 0)
}

/** A statistic lands or checking stops: lines settle, heads swap marks, the count counts and the bar moves. */
function change(root: HTMLElement, prev: WarmingUpProps, next: WarmingUpProps, options: MoveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline({ delay: options.delay ?? 0 })
  const was = new Map(prev.stats.map(s => [s.id, s.state]))
  const settled = next.stats.filter(s => was.get(s.id) === 'counting' && s.state !== 'counting')
  for (const stat of settled) settleLane(root, stat.id, options, tl)

  const stopped = prev.phase === 'warming' && next.phase === 'stopped'
  const fill = one(root, '[data-progress] > *')
  if (fill && share(prev) !== share(next) && !stopped) tl.add(extend(fill, { ...options, from: share(prev), to: share(next) }), 0)
  if (fill && stopped) {
    tl.add(
      isReduced(options)
        ? fade(fill, 'out')
        : gsap.fromTo(fill, { scaleX: share(prev), transformOrigin: 'left center' }, { scaleX: 0, duration: MOVES.extend.out, ease: EASE.exit }),
      0,
    )
  }
  const counter = one(root, '[data-ready-count]')
  if (counter && readyCount(prev) !== readyCount(next)) tl.add(count(counter, { ...options, from: readyCount(prev), to: readyCount(next) }), 0)

  if (stopped || settled.length) {
    const say = one(root, '[data-say]')
    if (say) tl.add(wipe(say, options), HEAD_SWAP)
    const lines = leadLines(root)
    if (lines.length) tl.add(wipe(lines, options), HEAD_SWAP + LEAD_FOLLOW)
  }
  if (stopped) {
    const mark = one(root, '[data-lead] [data-mark]')
    if (mark) tl.add(fade(mark), 0)
  }
  return tl
}

export const warmingUpMotion: PieceMotion<WarmingUpProps> = {
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const say = one(root, '[data-say]')
    if (say) tl.add(wipe(say, options), 0)
    const lines = leadLines(root)
    if (lines.length) tl.add(wipe(lines, options), LEAD_FOLLOW)
    const mark = one(root, '[data-lead] [data-mark]')
    if (mark) tl.add(fade(mark), 0)
    const card = one(root, '[data-card]')
    if (card) tl.add(rise(card, options), CARD_AT)
    const rows = rowsOf(root)
    if (rows.length) tl.add(slide(rows, options), CARD_AT)
    countingTracks(root).forEach((track, i) => tl.add(extend(track, options), TRACKS_AT + i * MOVES.slide.stagger))
    // The head sets down once its track is out; it never pops, because WarmingUp marks no latest point.
    const marks = heads(root)
    if (marks.length) tl.add(fade(marks, 'in', MOVES.slide.stagger), TRACKS_AT + MOVES.extend.in * 0.5)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, direction: 'out' as const }
    const marks = heads(root)
    if (marks.length) tl.add(fade(marks, 'out'), 0)
    const lanes = within(root, '[data-lane]')
    if (lanes.length) tl.add(extend(lanes, out), 0)
    const rows = rowsOf(root)
    if (rows.length) tl.add(slide(rows, out), 0)
    const card = one(root, '[data-card]')
    if (card) tl.add(rise(card, out), MOVES.slide.out * 0.5)
    const lead = within(root, '[data-say], [data-why], [data-when]')
    if (lead.length) tl.add(wipe(lead, out), 0)
    const mark = one(root, '[data-lead] [data-mark]')
    if (mark) tl.add(fade(mark, 'out'), 0)
    return tl
  },
  update: change,
  morph: change,
}
