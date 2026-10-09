import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const splitViewSpec = layoutSpec('SplitView', z.object({ level: z.boolean().optional() }).strict(), 'The main and side columns. Layout only.')
