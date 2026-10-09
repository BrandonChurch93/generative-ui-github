import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { count, extend, fade, MOVES, one, prefersReducedMotion, slide, wipe, within, type MoveOptions, type PieceMotion } from '../../motion'
import { formatCount, formatPercent, rankPeople, type Ranking } from './rank'
import type { ContributorRankProps } from './schema'

gsap.registerPlugin(Flip)

/** A bar starts over its track once the row has begun to land. */
const BAR_LAG = MOVES.slide.in * 0.4
/** A bar crossing the wall changes color over 300ms (README, Update). */
const CROSSFADE = 0.3
/** Exit: each row's bar retracts first, then its track, then the row leaves. */
const EXIT_STEP = MOVES.extend.out * 0.4

/** Rows and the band, top to bottom: the band takes its slot in the same stagger. */
const slots = (root: HTMLElement) => within(root, '[data-row], [data-band]')
const byHandle = (ranking: Ranking) => new Map(ranking.rows.map(r => [r.handle, r]))

function enterBand(band: HTMLElement, options: MoveOptions, at: number, tl: gsap.core.Timeline) {
  const key = one(band, '[data-band-key]')
  const text = one(band, '[data-band-text]')
  const rule = one(band, '[data-band-rule]')
  const tag = one(band, '[data-band-tag]')
  if (key) tl.add(extend(key, options), at)
  if (text) tl.add(wipe(text, options), at)
  if (rule) tl.add(extend(rule, options), at)
  if (tag) tl.add(slide(tag, options), at + MOVES.extend.in)
}

function countRow(row: HTMLElement, from: { count: number; percent: number }, to: { count: number; percent: number }, options: MoveOptions, at: number, tl: gsap.core.Timeline) {
  const share = one(row, '[data-share]')
  const n = one(row, '[data-count]')
  if (share) tl.add(count(share, { ...options, from: from.percent, to: to.percent, format: formatPercent }), at)
  if (n && from.count !== to.count) tl.add(count(n, { ...options, from: from.count, to: to.count, format: v => formatCount(Math.round(v)) }), at)
}

function colorOf(root: HTMLElement, wall: boolean): string {
  return getComputedStyle(root).getPropertyValue(wall ? '--data-1' : '--data-ref').trim()
}

/** Shared by update and morph: bars move from their current length, never from zero; the band moves with Flip. */
function rerank(root: HTMLElement, prev: ContributorRankProps, next: ContributorRankProps, options: MoveOptions & { captured?: unknown }) {
  const tl = gsap.timeline()
  const reduced = options.reduced ?? prefersReducedMotion()
  const [before, after] = [rankPeople(prev), rankPeople(next)]
  const old = byHandle(before)
  const now = byHandle(after)
  const all = slots(root)
  const arrived = all.filter(el => el.dataset.row !== undefined && !old.has(el.dataset.row))

  if (options.captured && !reduced) {
    const stayed = all.filter(el => !arrived.includes(el))
    tl.add(Flip.from(options.captured as Flip.FlipState, { targets: stayed, duration: MOVES.slide.in, ease: MOVES.slide.ease }), 0)
  }
  if (arrived.length) tl.add(reduced ? fade(arrived) : slide(arrived, options), 0)

  for (const row of within(root, '[data-row]')) {
    const handle = row.dataset.row ?? ''
    const was = old.get(handle)
    const is = now.get(handle)
    const bar = one(row, '[data-bar]')
    if (!is || !bar) continue
    if (!was) {
      tl.add(extend(bar, options), BAR_LAG)
      countRow(row, { count: 0, percent: 0 }, is, options, BAR_LAG, tl)
      continue
    }
    if (was.frac !== is.frac) {
      tl.add(
        reduced
          ? fade(bar)
          : gsap.fromTo(bar, { scaleX: was.frac / is.frac }, { scaleX: 1, duration: MOVES.extend.in, ease: MOVES.extend.ease, transformOrigin: 'left center' }),
        0,
      )
    }
    countRow(row, was, is, options, 0, tl)
    if (was.wall !== is.wall && !reduced) {
      tl.add(gsap.fromTo(bar, { backgroundColor: colorOf(root, was.wall) }, { backgroundColor: colorOf(root, is.wall), duration: CROSSFADE, ease: 'none', clearProps: 'backgroundColor' }), 0)
    }
  }

  const band = one(root, '[data-band]')
  if (band) {
    const text = one(band, '[data-band-text]')
    const sentence = (r: Ranking) => `${r.band.label} · ${r.band.sentence}`
    if (text && sentence(before) !== sentence(after)) tl.add(wipe(text, { ...options, delay: 0 }), 0)
    if (before.risk !== after.risk) {
      const key = one(band, '[data-band-key]')
      if (key) tl.add(fade(key), 0)
      const tag = one(band, '[data-band-tag]')
      if (tag) tl.add(slide(tag, options), 0)
    }
  }
  const foot = one(root, '[data-foot]')
  if (foot && before.rest?.words !== after.rest?.words) tl.add(wipe(foot, options), 0)
  return tl
}

export const contributorRankMotion: PieceMotion<ContributorRankProps> = {
  capture: root => Flip.getState(slots(root)),
  enter(root, props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const inner = { ...options, delay: 0 }
    const ranking = byHandle(rankPeople(props))
    const all = slots(root)
    all.forEach((el, i) => {
      const at = i * MOVES.slide.stagger
      if (el.dataset.band !== undefined) return enterBand(el, inner, at + BAR_LAG, tl)
      tl.add(slide(el, inner), at)
      const hairline = one(el, '[data-hairline]')
      const track = one(el, '[data-track]')
      const bar = one(el, '[data-bar]')
      if (hairline) tl.add(extend(hairline, inner), at)
      if (track) tl.add(extend(track, inner), at)
      if (bar) tl.add(extend(bar, inner), at + BAR_LAG)
      const row = ranking.get(el.dataset.row ?? '')
      if (row) countRow(el, { count: row.count, percent: 0 }, row, inner, at + BAR_LAG, tl)
    })
    const foot = one(root, '[data-foot]')
    if (foot) tl.add(wipe(foot, inner), all.length * MOVES.slide.stagger + BAR_LAG + MOVES.extend.in * 0.5)
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const out = { ...options, delay: 0, direction: 'out' as const }
    const foot = one(root, '[data-foot]')
    const start = foot ? MOVES.wipe.out * 0.5 : 0
    if (foot) tl.add(wipe(foot, out), 0)
    slots(root)
      .reverse()
      .forEach((el, i) => {
        const at = start + i * MOVES.slide.stagger
        if (el.dataset.band !== undefined) {
          const tag = one(el, '[data-band-tag]')
          const rule = one(el, '[data-band-rule]')
          const text = one(el, '[data-band-text]')
          const key = one(el, '[data-band-key]')
          if (tag) tl.add(slide(tag, out), at)
          if (rule) tl.add(extend(rule, out), at)
          if (text) tl.add(wipe(text, out), at)
          if (key) tl.add(extend(key, out), at + EXIT_STEP)
          return
        }
        const bar = one(el, '[data-bar]')
        const track = one(el, '[data-track]')
        const hairline = one(el, '[data-hairline]')
        if (bar) tl.add(extend(bar, out), at)
        if (track) tl.add(extend(track, out), at + EXIT_STEP)
        if (hairline) tl.add(extend(hairline, out), at + EXIT_STEP)
        tl.add(slide(el, out), at + EXIT_STEP * 2)
      })
    return tl
  },
  update: (root, prev, next, options = {}) => rerank(root, prev, next, options),
  morph(root, prev, next, options = {}) {
    const tl = rerank(root, prev, next, options)
    const title = one(root, '[data-card-head] h2, [data-card-head] h3')
    if (title && prev.title !== next.title) tl.add(wipe(title, { ...options, delay: 0 }), 0)
    return tl
  },
}
