import { registry } from '@genui-github/ui/registry'
import { BINDERS_A } from './group-a'
import { BINDERS_B } from './group-b'
import { BINDERS_C } from './group-c'
import type { Piece } from '@genui-github/renderer/core'
import type { WarmingInfo } from '@genui-github/ui/schemas'
import type { Binder, DataContext } from './types'

/** The CHECK_SCHEDULE's last check, in seconds: how far along a warming lane can be. */
const LAST_CHECK_S = 120

function warmingInfo(ctx: DataContext): WarmingInfo {
  const w = ctx.warming
  const progress = w ? Math.min(1, w.elapsedMs / (LAST_CHECK_S * 1000)) : 0
  const nextCheck = w?.phase === 'warming' ? `checking again in ${Math.max(1, Math.round(w.nextCheckMs / 1000))}s` : 'GitHub has not finished yet'
  return { counting: 'GitHub is counting', nextCheck, progress }
}

/**
 * A stat GitHub is still counting is the warming state, never an error (CLAUDE.md, Data). The binders say so in
 * the cause they write; here that becomes the warming state with the system's words, in one place.
 */
function warmingAware<P>(binder: Binder<P>): Binder<P> {
  return (ctx, props, extras) => {
    const piece = binder(ctx, props, extras)
    if (piece.state !== 'error' || !piece.error?.cause.startsWith('GitHub is still counting')) return piece
    const { error: _error, ...rest } = piece
    return { ...rest, state: 'warming', warming: warmingInfo(ctx) } satisfies Piece
  }
}

const all = { ...BINDERS_A, ...BINDERS_B, ...BINDERS_C } as Record<string, Binder<never>>

/** Every pickable component's binder, by name: templates and off-template composition bind through these. */
export const BINDERS: Readonly<Record<string, Binder<never>>> = Object.fromEntries(Object.entries(all).map(([name, b]) => [name, warmingAware(b)]))

/** Pickable components with no binder: a test keeps this empty. */
export const unbound = () => registry.all().filter(s => s.pickable && !(s.name in BINDERS)).map(s => s.name)

export * from './types'
