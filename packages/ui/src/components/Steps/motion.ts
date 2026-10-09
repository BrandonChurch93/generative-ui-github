import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { count, fade, MOVES, one, REDUCED, prefersReducedMotion, slide, within, type MoveOptions, type PieceMotion } from '../../motion'
import type { StepsProps } from './schema'
import { splitFact } from './fact'

const stepsOf = (root: HTMLElement) => within(root, '[data-row]')
const segmentOf = (step: HTMLElement) => step.querySelector<HTMLElement>(':scope > [data-spine]')
const isReduced = (options: MoveOptions) => options.reduced ?? prefersReducedMotion()

/** The extend move turned downward: a spine segment grows from its ring and retracts back up into it. */
function extendDown(segment: HTMLElement, options: MoveOptions = {}): gsap.core.Timeline {
  const direction = options.direction ?? 'in'
  if (isReduced(options)) {
    gsap.set(segment, { scaleY: 1 })
    return fade(segment, direction)
  }
  const tl = gsap.timeline()
  const [from, to, duration] = direction === 'in' ? [0, 1, MOVES.extend.in] : [1, 0, MOVES.extend.out]
  tl.fromTo(segment, { scaleY: from, transformOrigin: 'center top' }, { scaleY: to, duration, ease: MOVES.extend.ease })
  return tl
}

interface Ghost {
  node: HTMLElement
  top: number
  left: number
  width: number
}

interface StepsCapture {
  flip: Flip.FlipState
  ghosts: Map<string, Ghost>
}

const isCapture = (value: unknown): value is StepsCapture =>
  typeof value === 'object' && value !== null && 'flip' in value && 'ghosts' in value

/** A step that is about to be dropped is gone after the commit, so a copy of it slides out where it stood. */
function slideOutGhosts(root: HTMLElement, captured: StepsCapture, dropped: string[], options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  const list = one(root, '[data-steps]')
  if (!list) return tl
  dropped.forEach((id, i) => {
    const ghost = captured.ghosts.get(id)
    if (!ghost) return
    const node = ghost.node
    node.removeAttribute('data-row')
    node.setAttribute('aria-hidden', 'true')
    node.inert = true
    gsap.set(node, { position: 'absolute', top: ghost.top, left: ghost.left, width: ghost.width, margin: 0, pointerEvents: 'none' })
    list.appendChild(node)
    const segment = segmentOf(node)
    if (segment) tl.add(extendDown(segment, { ...options, direction: 'out' }), i * MOVES.slide.stagger)
    tl.add(slide(node, { ...options, direction: 'out' }), i * MOVES.slide.stagger)
  })
  tl.call(() => dropped.forEach(id => captured.ghosts.get(id)?.node.remove()))
  return tl
}

/** Facts count to their new figure; any other changed words fade in over 200ms. */
function changeWords(root: HTMLElement, prev: StepsProps, next: StepsProps, options: MoveOptions): gsap.core.Timeline {
  const tl = gsap.timeline()
  const before = new Map(prev.steps.map(s => [s.id, s]))
  for (const step of next.steps) {
    const old = before.get(step.id)
    const node = one(root, `[data-row="${CSS.escape(step.id)}"]`)
    if (!old || !node) continue
    const [title, body] = within(node, '[data-words]')
    if (title && old.title !== step.title) tl.add(fade(title), 0)
    if (body && old.body !== step.body) tl.add(fade(body), 0)
    const link = node.querySelector('a, button')
    if (link && old.link?.label !== step.link?.label) tl.add(fade(link), 0)
    const fact = node.querySelector<HTMLElement>('[data-fact]')
    if (!fact || old.fact === step.fact) continue
    const a = old.fact ? splitFact(old.fact) : undefined
    const b = splitFact(step.fact ?? '')
    const figure = fact.querySelector('[data-count]')
    if (figure && a?.value !== undefined && b.value !== undefined && a.before === b.before && a.after === b.after) {
      tl.add(count(figure, { ...options, from: a.value, to: b.value, format: v => Math.round(v).toLocaleString('en-US') }), 0)
    } else {
      tl.add(fade(fact), 0)
    }
  }
  return tl
}

/** The start wears the accent; when a different step becomes first, the ring colors cross over in the 200ms of a crossfade. */
function moveAccent(root: HTMLElement, prev: StepsProps, next: StepsProps): gsap.core.Timeline {
  const tl = gsap.timeline()
  const was = prev.steps[0]?.id
  const now = next.steps[0]?.id
  if (!was || !now || was === now) return tl
  const first = one(root, '[data-row][data-first] [data-ring]')
  const plain = one(root, '[data-row]:not([data-first]) [data-ring]')
  if (!first || !plain) return tl
  const accent = getComputedStyle(first)
  const quiet = getComputedStyle(plain)
  const a = { borderColor: accent.borderColor, color: accent.color }
  const q = { borderColor: quiet.borderColor, color: quiet.color }
  tl.fromTo(first, q, { ...a, duration: REDUCED.duration, ease: REDUCED.ease, clearProps: 'borderColor,color' }, 0)
  const demoted = one(root, `[data-row="${CSS.escape(was)}"] [data-ring]`)
  if (demoted) tl.fromTo(demoted, a, { ...q, duration: REDUCED.duration, ease: REDUCED.ease, clearProps: 'borderColor,color' }, 0)
  return tl
}

export const stepsMotion: PieceMotion<StepsProps> = {
  capture(root) {
    const steps = stepsOf(root)
    const list = one(root, '[data-steps]')
    const origin = list?.getBoundingClientRect()
    const ghosts = new Map<string, Ghost>()
    for (const step of steps) {
      const rect = step.getBoundingClientRect()
      ghosts.set(step.dataset.row ?? '', {
        node: step.cloneNode(true) as HTMLElement,
        top: rect.top - (origin?.top ?? 0),
        left: rect.left - (origin?.left ?? 0),
        width: rect.width,
      })
    }
    return { flip: Flip.getState(steps), ghosts } satisfies StepsCapture
  },
  enter(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const steps = stepsOf(root)
    if (!steps.length) return tl
    tl.add(slide(steps, options), 0)
    // Each segment extends from its ring as the step below it arrives, so the path draws itself to the last step.
    steps.forEach((step, i) => {
      const segment = segmentOf(step)
      if (segment) tl.add(extendDown(segment, options), (i + 1) * MOVES.slide.stagger)
    })
    return tl
  },
  exit(root, _props, options = {}) {
    const tl = gsap.timeline({ delay: options.delay ?? 0 })
    const steps = stepsOf(root)
    if (!steps.length) return tl
    const n = steps.length
    tl.add(slide([...steps].reverse(), { ...options, direction: 'out' }), 0)
    steps.forEach((step, i) => {
      const segment = segmentOf(step)
      if (segment) tl.add(extendDown(segment, { ...options, direction: 'out' }), (n - 2 - i) * MOVES.slide.stagger)
    })
    return tl
  },
  update(root, prev, next, options = {}) {
    const tl = gsap.timeline()
    tl.add(changeWords(root, prev, next, options), 0)
    return tl
  },
  morph(root, prev, next, options = {}) {
    const tl = gsap.timeline()
    const reduced = isReduced(options)
    const steps = stepsOf(root)
    const prevIndex = new Map(prev.steps.map((s, i) => [s.id, i]))
    const nextIds = new Set(next.steps.map(s => s.id))
    const arrived = steps.filter(s => !prevIndex.has(s.dataset.row ?? ''))
    const survivors = steps.filter(s => prevIndex.has(s.dataset.row ?? ''))
    const dropped = prev.steps.map(s => s.id).filter(id => !nextIds.has(id))
    const captured = isCapture(options.captured) ? options.captured : undefined

    if (captured && dropped.length) tl.add(slideOutGhosts(root, captured, dropped, options), 0)
    if (captured && !reduced && survivors.length) {
      tl.add(Flip.from(captured.flip, { targets: survivors, duration: MOVES.slide.in, ease: MOVES.slide.ease }), 0)
    }
    if (arrived.length) tl.add(slide(arrived, options), 0)

    steps.forEach((step, i) => {
      const id = step.dataset.row ?? ''
      const was = prevIndex.get(id)
      const segment = segmentOf(step)
      // A segment is new when its step is new or was the last one before.
      if (segment && (was === undefined || was === prev.steps.length - 1)) tl.add(extendDown(segment, options), MOVES.slide.stagger)
      const numeral = step.querySelector('[data-numeral]')
      if (numeral && was !== undefined && was !== i) tl.add(count(numeral, { ...options, from: was + 1, to: i + 1 }), 0)
    })

    tl.add(moveAccent(root, prev, next), 0)
    tl.add(changeWords(root, prev, next, options), 0)
    return tl
  },
}
