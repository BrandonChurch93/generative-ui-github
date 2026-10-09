import { registry } from '@genui-github/ui/registry'
import { BINDERS_A } from './group-a'
import { BINDERS_B } from './group-b'
import { BINDERS_C } from './group-c'
import type { Binder } from './types'

/** Every pickable component's binder, by name: templates and off-template composition bind through these. */
export const BINDERS: Readonly<Record<string, Binder<never>>> = { ...BINDERS_A, ...BINDERS_B, ...BINDERS_C }

/** Pickable components with no binder: a test keeps this empty. */
export const unbound = () => registry.all().filter(s => s.pickable && !(s.name in BINDERS)).map(s => s.name)

export * from './types'
