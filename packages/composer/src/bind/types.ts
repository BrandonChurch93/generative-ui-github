import type { z } from 'zod'
import type { DataContext } from '@genui-github/data/server'
import type { Piece } from '@genui-github/renderer/core'
import { registry, type ErrorInfo, type Emphasis, type Tone } from '@genui-github/ui/schemas'

// A binder turns a component's model-facing props and a data context into the piece the renderer draws:
// the same props back, plus the `bound` props the component renders. Templates call binders directly;
// off-template composition binds what Sonnet chose through the same binders. Nothing here calls a model.

export type { DataContext }

/** What the composition says about a piece beyond its props. */
export interface PieceExtras {
  ask?: string
  emphasis?: Emphasis
  tone?: Tone
}

export type Binder<P = unknown> = (ctx: DataContext, props: P, extras?: PieceExtras) => Piece

/** A bound piece in its default state, its id derived from the props as the registry says. */
export function bound(component: string, props: unknown, bound: unknown, extras: PieceExtras & { cites?: number[] } = {}): Piece {
  const { cites, ...rest } = extras
  return { id: registry.deriveId(component, props), component, props, ...rest, bound, ...(cites?.length ? { cites } : {}) }
}

/** The data answered with nothing: the component's empty state, with the system's words in its bound props. */
export function empty(component: string, props: unknown, boundProps: unknown, extras: PieceExtras = {}): Piece {
  return { ...bound(component, props, boundProps, extras), state: 'empty' }
}

/** The data the piece needs is not in the context: its error state, never crit, saying what is missing. */
export function unavailable(component: string, props: unknown, boundProps: unknown, error: ErrorInfo, extras: PieceExtras = {}): Piece {
  return { ...bound(component, props, boundProps, extras), state: 'error', error }
}

/** The props a component's registry schema accepts. */
export type ModelProps<S extends z.ZodType> = z.infer<S>
