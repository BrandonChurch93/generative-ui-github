import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const askSpec = layoutSpec(
  'Ask',
  z.object({ label: z.string().min(1).max(40), ask: z.string().min(1).max(160), selected: z.boolean().optional() }).strict(),
  'A suggested question chip. Shell only.',
)
