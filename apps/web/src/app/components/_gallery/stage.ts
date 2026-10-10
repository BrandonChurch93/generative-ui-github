import { useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { animate } from 'motion/react'
import { CATALOG, CATALOG_GROUPS, type CatalogEntry, type CatalogGroup } from '@genui-github/ui/catalog'
import { MOVES, REDUCED } from '@genui-github/ui/motion'
import { COMPONENT_STATES, type ComponentState, type Density } from '@genui-github/ui'

/** The owner's order for the category bar; a group added to the catalog later lands after these. */
const ORDER: readonly CatalogGroup[] = ['Data', 'Text', 'Actions', 'Paths', 'System', 'Code', 'Inputs', 'Primitives']

export const CATEGORIES: CatalogGroup[] = [...ORDER, ...CATALOG_GROUPS.filter(g => !ORDER.includes(g))].filter(g => CATALOG.some(e => e.group === g))

export const inCategory = (group: CatalogGroup) => CATALOG.filter(e => e.group === group)

export const DENSITY_LABELS: Record<Density, string> = { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' }

export const STATE_LABELS: Record<ComponentState, string> = {
  default: 'Default',
  skeleton: 'Skeleton',
  empty: 'Empty',
  error: 'Error',
  warming: 'Warming',
}

// The renderer's card curves, as Motion takes them: the house arrival curve, and power2.in for the sink.
export const ARRIVE = [0.25, 1, 0.5, 1] as const
export const EXIT = [0.55, 0.085, 0.68, 0.53] as const

/** Every card in a set starts this long after the one before it, on the way in and on the way out. */
export const STAGGER = 0.06
/** A skeleton frame fills once it has risen into place. */
export const FILL_AFTER = MOVES.rise.in
/** Frames the server drew are already in place, so they fill almost at once. */
export const FIRST_FILL = 0.15
/** A card sinks once its insides are half gone, or after this long, as on a composed screen. */
export const SINK_AFTER = 0.25

export function omittedStates(entry: CatalogEntry): Map<ComponentState, string> {
  return new Map<ComponentState, string>((entry.spec?.statesOmitted ?? []).map(o => [o.state, o.reason]))
}

export function shownStates(entry: CatalogEntry): ComponentState[] {
  const omitted = omittedStates(entry)
  return COMPONENT_STATES.filter(s => !omitted.has(s))
}

export function propsFor(entry: CatalogEntry, state: ComponentState): unknown {
  return state === 'empty' && entry.sample.empty ? entry.sample.empty : entry.sample.props
}

/** The height class the registry gives a component; parts and layout primitives have none. */
export function heightWord(entry: CatalogEntry): string {
  if (!entry.spec) return 'part'
  return entry.spec.heightClass ?? 'layout'
}

/** `?still` draws every set settled, with no motion: for screenshots and the accessibility sweep. */
export function isStill(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('still')
}

const never = () => () => {}

/** The server cannot see the query, so it draws the frames; the client settles them after hydrating. */
export function useStill(): boolean {
  return useSyncExternalStore(never, isStill, () => false)
}

/** Starts a component's choreography after `delay`, without handing the delay to the component's own primitives. */
export function later(delay: number, tl: gsap.core.Timeline): gsap.core.Timeline {
  return delay > 0 ? gsap.timeline({ delay }).add(tl, 0) : tl
}

export function riseIn(el: Element, delay: number, reduced: boolean) {
  return reduced
    ? animate(el, { opacity: [0, 1] }, { duration: REDUCED.duration, ease: 'linear', delay })
    : animate(el, { opacity: [0, 1], y: [MOVES.rise.distance, 0] }, { duration: MOVES.rise.in, ease: ARRIVE, delay })
}

export function sinkOut(el: Element, delay: number, reduced: boolean) {
  return reduced
    ? animate(el, { opacity: 0 }, { duration: REDUCED.duration, ease: 'linear', delay })
    : animate(el, { opacity: 0, y: MOVES.rise.distance }, { duration: MOVES.rise.out, ease: EXIT, delay })
}

export function onScreen(el: Element): boolean {
  const box = el.getBoundingClientRect()
  return box.bottom > 0 && box.top < window.innerHeight
}
