import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const surfaceSpec = layoutSpec('Surface', z.object({ tint: z.boolean().optional() }).strict(), 'A plain card ground. Layout only.')
