import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const textSpec = layoutSpec('Text', z.object({ look: z.enum(['body', 'lead', 'hint', 'meta']).optional() }).strict(), 'Body, lead, hint or meta text. Layout only.')
