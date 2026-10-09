import { z } from 'zod'
import type { ComponentSpec, OmittedState } from '../registry'

const NO_DATA = 'Layout has no data.'

/** Layout primitives render one way: they arrange pieces, so loading, empty, failed and warming belong to what they hold. */
export const LAYOUT_STATES_OMITTED: OmittedState[] = [
  { state: 'skeleton', reason: NO_DATA },
  { state: 'empty', reason: NO_DATA },
  { state: 'error', reason: NO_DATA },
  { state: 'warming', reason: NO_DATA },
]

export function layoutSpec<S extends z.ZodType>(name: string, schema: S, when: string): ComponentSpec<S> {
  return { name, schema, when, pickable: false, statesOmitted: LAYOUT_STATES_OMITTED }
}
