import type { MoveOptions } from './primitives'

/**
 * The four choreographies every component ships, composed from the primitives. They animate what is inside
 * the piece; the card around it (rise, sink, Flip) belongs to Motion in the renderer.
 */
export interface PieceMotion<P> {
  enter(root: HTMLElement, props: P, options?: MoveOptions): gsap.core.Timeline
  /** The strict reverse of enter. */
  exit(root: HTMLElement, props: P, options?: MoveOptions): gsap.core.Timeline
  /** Live data under a composition that is not being rewritten. No exits, no rises. */
  update(root: HTMLElement, prev: P, next: P, options?: MoveOptions): gsap.core.Timeline
  /** The piece survives a rewrite: it changes in place, never remounts. */
  morph(root: HTMLElement, prev: P, next: P, options?: MoveOptions): gsap.core.Timeline
}

export function within(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)]
}

export function one(root: HTMLElement, selector: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(selector)
}
