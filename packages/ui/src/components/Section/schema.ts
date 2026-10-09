import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const sectionSpec = layoutSpec(
  'Section',
  z.object({ title: z.string().min(1).max(48), meta: z.string().max(40).optional() }).strict(),
  'A titled group of pieces. Layout only.',
)
