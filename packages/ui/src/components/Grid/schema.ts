import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const gridSpec = layoutSpec('Grid', z.object({ columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional() }).strict(), 'Pieces in equal columns. Layout only.')
