import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const drawerSpec = layoutSpec(
  'Drawer',
  z.object({ title: z.string().min(1).max(48), sub: z.string().max(80).optional() }).strict(),
  'A sheet from the right edge. Shell only.',
)
