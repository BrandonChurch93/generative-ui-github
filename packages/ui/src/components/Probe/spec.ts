import { z } from 'zod'
import type { ComponentSpec } from '../../registry'

// Scaffolding for the catalog shell (plan 1.3 and 1.4). Removed when Metric lands in 2.1.
export const probeSchema = z
  .object({
    label: z.string().max(28),
    measure: z.string(),
  })
  .strict()

export type ProbeModelProps = z.infer<typeof probeSchema>
export type ProbeProps = ProbeModelProps & { value: number; suffix?: string }

export const probeSpec: ComponentSpec<typeof probeSchema> = {
  name: 'Probe',
  schema: probeSchema,
  when: 'Never. A placeholder that proves the catalog renders a registered spec.',
  heightClass: 'fixed',
  pickable: false,
  statesOmitted: [{ state: 'warming', reason: 'A probe reads nothing from the stats endpoints.' }],
  id: { key: p => p.measure },
}
