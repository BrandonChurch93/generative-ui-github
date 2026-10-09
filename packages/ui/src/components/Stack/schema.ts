import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const stackSpec = layoutSpec('Stack', z.object({ gap: z.enum(['region', 'card', 'row']).optional() }).strict(), 'Pieces one above the other. Layout only.')
