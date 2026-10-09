import { gsap } from 'gsap'
import { EASE, fade, INTERACTION, prefersReducedMotion, type Direction, type MoveOptions, type PieceMotion } from '../../motion'
import type { SelectProps } from './schema'

// The menu's card shadow overhangs its box, so the clip runs wide and below enough to keep it.
const SHUT = 'inset(0% -50% 100% -50%)'
const SHOWN = 'inset(0% -50% -50% -50%)'

/**
 * The menu unrolls from the trigger, a clip reveal top to bottom with its rows and no stagger, and rolls back up
 * to close. The chevron turns over in the same time. Reduced, the menu fades and the chevron just turns.
 */
export function menuMotion(
  menu: Element,
  chevron: Element | null,
  direction: Direction,
  options: MoveOptions = {},
): gsap.core.Timeline {
  const opening = direction === 'in'
  if (options.reduced ?? prefersReducedMotion()) {
    if (chevron) gsap.set(chevron, { rotation: opening ? 180 : 0 })
    return fade(menu, direction)
  }
  const tl = gsap.timeline()
  const duration = INTERACTION.menu
  const ease = opening ? EASE.arrive : EASE.exit
  tl.fromTo(
    menu,
    { clipPath: opening ? SHUT : SHOWN },
    { clipPath: opening ? SHOWN : SHUT, duration, ease, ...(opening ? { clearProps: 'clipPath' } : {}) },
    0,
  )
  if (chevron) tl.to(chevron, { rotation: opening ? 180 : 0, duration, ease, transformOrigin: '50% 50%' }, 0)
  return tl
}

// The field arrives with its card and has no move of its own; the menu runs from inside the component on the
// reader's keys and clicks, and the message slot wipes from inside the shared MessageSlot.
export const selectMotion: PieceMotion<SelectProps> = {
  enter: () => gsap.timeline(),
  exit: () => gsap.timeline(),
  update: () => gsap.timeline(),
  morph: () => gsap.timeline(),
}
