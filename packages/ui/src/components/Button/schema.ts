import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const buttonSpec = layoutSpec('Button', z.object({ variant: z.enum(['primary', 'secondary']).optional() }).strict(), 'A button. Layout only.')
