import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { lower } from '../TextInput/schema'

export const CHIP_MODES = ['single', 'multi'] as const
export type ChipMode = (typeof CHIP_MODES)[number]

export const chipOptionSchema = z.object({ value: z.string().min(1).max(40), label: z.string().min(1).max(32) }).strict()

/** The fields a FilterChips group has wherever it sits. */
export const chipsShape = {
  mode: z.enum(CHIP_MODES),
  options: z.array(chipOptionSchema).min(2).max(12),
  /** Single: exactly one. Multi: any number, and none means no filter. */
  selected: z.array(z.string().min(1).max(40)).max(12),
}

export function refineChips(
  field: { mode: ChipMode; options: { value: string }[]; selected: string[] },
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void },
) {
  const values = field.options.map(o => o.value)
  if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: 'Option values must be unique', path: ['options'] })
  if (field.selected.some(v => !values.includes(v))) {
    ctx.addIssue({ code: 'custom', message: 'selected must name option values', path: ['selected'] })
  }
  if (field.mode === 'single' && field.selected.length !== 1) {
    ctx.addIssue({ code: 'custom', message: 'single mode selects exactly one option', path: ['selected'] })
  }
}

/** Standalone, directly above the list or chart it narrows. `label` only when it sits inside a Form. */
export const filterChipsSchema = z
  .object({ target: z.string().min(1).max(80), ...chipsShape, label: z.string().min(1).max(32).optional() })
  .strict()
  .superRefine(refineChips)

export type FilterChipsModelProps = z.infer<typeof filterChipsSchema>

export interface ChipOption {
  value: string
  label: string
}

/** What FilterChips renders: the model's slices plus what the system binds from the target. */
export interface FilterChipsProps {
  /** The id of the piece it filters. Empty inside a Form, where the chips are a field like any other. */
  target: string
  mode: ChipMode
  options: ChipOption[]
  selected: string[]
  label?: string
  /** System. What each chip would show, counted by code from the target's data. Absent while that data is on its way. */
  counts?: Record<string, number>
  /** System. What the chips narrow, for the group's name: "v16.2 pull requests by area". */
  filters?: string
  /** System. While the target rewrites; a chosen chip keeps its check and tint. */
  disabled?: boolean
  /** System. The field's key in a Form's submitted values; derived from the label when absent. */
  name?: string
  /** System. Called with the new selection. */
  onChange?: (selected: string[]) => void
}

/** Every word the group says that is not a chip label. */
export const chipWords = {
  group: (filters: string | undefined, label: string | undefined) =>
    filters ? `Filter ${filters}` : label ? `Filter by ${lower(label)}` : 'Filter the card below',
  chip: (label: string, count: number | undefined) => (count === undefined ? label : `${label}, ${count}`),
  counting: 'Counting what each filter would show.',
  more: 'more',
  less: 'Show less',
}

export const filterChipsSpec: ComponentSpec<typeof filterChipsSchema> = {
  name: 'FilterChips',
  schema: filterChipsSchema,
  when: 'A few slices the reader may narrow the list or chart directly below to: states, areas, labels, a window. Counts come from that data.',
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    { state: 'empty', reason: 'A filter with no slices is never composed.' },
    { state: 'error', reason: 'When the target fails its counts drop out and the chips disable; the target card owns the error.' },
    { state: 'warming', reason: 'An input never waits on a GitHub 202; while its target warms the counts stay loading.' },
  ],
  id: { key: p => p.target },
  example: {
    target: 'statuslist:pull:milestone-v16.2',
    mode: 'multi',
    options: [
      { value: 'turbopack', label: 'Turbopack' },
      { value: 'router', label: 'Router' },
      { value: 'cache', label: 'Cache' },
    ],
    selected: ['turbopack'],
  },
}
