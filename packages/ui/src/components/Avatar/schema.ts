import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const avatarSpec = layoutSpec('Avatar', z.object({ handle: z.string().min(1).max(39) }).strict(), 'A person as initials from their handle. Layout only.')
