import { z } from 'zod'
import { layoutSpec } from '../../layout/spec'

export const tabsSpec = layoutSpec('Tabs', z.object({ label: z.string().min(1).max(40) }).strict(), 'Panels behind a row of tabs. Layout only.')
