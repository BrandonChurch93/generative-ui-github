import { gsap } from 'gsap'
import { EASE, fade, INTERACTION, prefersReducedMotion, type MoveOptions, type PieceMotion } from '../../motion'
import type { TextInputProps } from './schema'

/**
 * The message slot rewrites at feedback speed: the old line wipes out left to right as the new one wipes in.
 * Either side may be missing (a helper appearing, an error clearing). Reduced, it is the 200ms opacity swap.
 */
export function swapMessage(old: Element | null, next: Element | null, options: MoveOptions = {}): gsap.core.Timeline {
  const tl = gsap.timeline()
  if (options.reduced ?? prefersReducedMotion()) {
    if (old) tl.add(fade(old, 'out'), 0)
    if (next) tl.add(fade(next, 'in'), 0)
    return tl
  }
  const duration = INTERACTION.messageWipe
  if (old) {
    tl.fromTo(old, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)', duration, ease: EASE.travel }, 0)
  }
  if (next) {
    tl.fromTo(
      next,
      { clipPath: 'inset(0% 100% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration, ease: EASE.travel, clearProps: 'clipPath' },
      0,
    )
  }
  return tl
}

// The field arrives with its card and has no move of its own. Its one motion, the message wipe, runs from inside
// the component on the reader's actions and on GitHub's verdicts, because it needs the line being replaced.
export const textInputMotion: PieceMotion<TextInputProps> = {
  enter: () => gsap.timeline(),
  exit: () => gsap.timeline(),
  update: () => gsap.timeline(),
  morph: () => gsap.timeline(),
}
