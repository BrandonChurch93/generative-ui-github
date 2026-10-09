import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const listSpec = layoutSpec('List', z.object({ ordered: z.boolean().optional() }).strict(), 'A plain list in the row rhythm. Layout only.')
