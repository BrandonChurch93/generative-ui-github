import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { prose } from '../../schema/shared'
import { slug, type FieldStatus } from '../TextInput/schema'

export const selectOptionSchema = z.object({ value: z.string().min(1).max(64), label: z.string().min(1).max(48) }).strict()

/** The model-facing fields, shared with the Select entry of a Form's `fields`. */
export const selectShape = {
  label: z.string().min(1).max(32),
  options: z.array(selectOptionSchema).min(1).max(24),
  /** An option's value, or "" when nothing is chosen yet and the placeholder shows. */
  value: z.string().max(64),
  placeholder: z.string().min(1).max(48).optional(),
  helper: prose(80).optional(),
  required: z.boolean().optional(),
}

export function refineSelect(
  field: { options: { value: string }[]; value: string },
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void },
) {
  const values = field.options.map(o => o.value)
  if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: 'Option values must be unique', path: ['options'] })
  if (field.value !== '' && !values.includes(field.value)) {
    ctx.addIssue({ code: 'custom', message: 'value must be one of the option values, or ""', path: ['value'] })
  }
}

export const selectSchema = z.object(selectShape).strict().superRefine(refineSelect)

export type SelectModelProps = z.infer<typeof selectSchema>

export interface SelectOption {
  value: string
  label: string
  /** System. The option's count from data already fetched, in the system's words ("7 open"). Never the model's. */
  meta?: string
}

/** What Select renders: the model's choices plus what the system binds. */
export interface SelectProps {
  label: string
  /** Bound from data. None renders the field disabled with the reason in the helper's slot. */
  options: SelectOption[]
  value: string
  placeholder?: string
  helper?: string
  required?: boolean
  /** System. The field's key in a Form's submitted values; derived from the label when absent. */
  name?: string
  /** System. Only `invalid` applies: options come from data on screen, so there is nothing to check with GitHub. */
  status?: FieldStatus
  /** System. A disabled field always says why: `reason` takes the helper's slot. */
  disabled?: boolean
  /** System. Why it is disabled or has no options, such as "No open milestones on this repo". */
  reason?: string
  /** System. Called with the chosen option's value. */
  onChange?: (value: string) => void
}

export const selectSpec: ComponentSpec<typeof selectSchema> = {
  name: 'Select',
  schema: selectSchema,
  when: 'Only inside a Form, for one choice among more than four options or options with long labels.',
  pickable: false,
  statesOmitted: [
    { state: 'skeleton', reason: 'Options arrive with the schema from data already on the screen.' },
    { state: 'empty', reason: 'No options renders the field disabled with the reason in the helper.' },
    { state: 'warming', reason: 'An input never waits on a GitHub 202.' },
  ],
  id: { key: p => slug(p.label) },
  example: {
    label: 'Milestone',
    options: [
      { value: 'v16.2', label: 'v16.2' },
      { value: 'v16.3', label: 'v16.3' },
      { value: 'v17.0', label: 'v17.0' },
      { value: 'none', label: 'No milestone' },
      { value: 'backlog', label: 'Backlog' },
    ],
    value: 'v16.2',
  },
}
