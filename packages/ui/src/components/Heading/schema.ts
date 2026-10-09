import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const headingSpec = layoutSpec(
  'Heading',
  z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), look: z.enum(['question', 'section', 'card-title']).optional() }).strict(),
  'A heading in the system type styles. Layout only.',
)
