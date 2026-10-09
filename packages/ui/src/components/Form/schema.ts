import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { chipsShape, refineChips, type FilterChipsProps } from '../FilterChips/schema'
import { refineSelect, selectShape, type SelectProps } from '../Select/schema'
import { slug, textInputShape, type TextInputProps } from '../TextInput/schema'

export const formFieldSchema = z.discriminatedUnion('component', [
  z.object({ component: z.literal('TextInput'), ...textInputShape }).strict(),
  z.object({ component: z.literal('Select'), ...selectShape }).strict().superRefine(refineSelect),
  z.object({ component: z.literal('FilterChips'), label: z.string().min(1).max(32), ...chipsShape }).strict().superRefine(refineChips),
])

export const formSchema = z
  .object({
    title: z.string().min(1).max(40),
    /** The current scope. */
    meta: z.string().min(1).max(48).optional(),
    fields: z.array(formFieldSchema).min(1).max(4),
    /** The primary's label, a verb phrase such as "Ask again". */
    submit: z.string().min(1).max(24),
    secondary: z.enum(['Reset', 'Cancel']).optional(),
    /** What submit does, such as "replaces this screen". */
    effect: z.string().min(1).max(40),
  })
  .strict()
  .superRefine((form, ctx) => {
    const labels = form.fields.map(f => slug(f.label))
    if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: 'Field labels must differ', path: ['fields'] })
  })

export type FormModelProps = z.infer<typeof formSchema>

interface FieldBinding {
  /** System. The name of the field this one waits on: while that one is wrong or checking, this one is disabled and says so. */
  dependsOn?: string
}

/** A field as the Form renders it: the model's spec plus what the system binds (value, options' counts, GitHub's verdict). */
export type FormField =
  | ({ component: 'TextInput' } & TextInputProps & FieldBinding)
  | ({ component: 'Select' } & SelectProps & FieldBinding)
  | ({ component: 'FilterChips'; label: string } & Omit<FilterChipsProps, 'target' | 'label'> & FieldBinding)

export type FormValues = Record<string, string | string[]>

/** What Form renders: the model's fields and words plus what the system binds. */
export interface FormProps {
  title: string
  meta?: string
  fields: FormField[]
  submit: string
  secondary?: 'Reset' | 'Cancel'
  effect: string
  /** System. True while the request runs; the screen rewrite is the confirmation. Absent, the form tracks its own submit. */
  submitting?: boolean
  /** System. Receives the values by field name when every field checks out. */
  onSubmit?: (values: FormValues) => void
  /** System. Cancel's action; without it Cancel restores the values the form arrived with. */
  onCancel?: () => void
}

/** A field's key in the submitted values. */
export const fieldName = (field: { name?: string; label: string }, index: number) => field.name ?? (slug(field.label) || `field-${index + 1}`)

export const formWords = {
  failed: "Couldn't ask again",
}

export const formSpec: ComponentSpec<typeof formSchema> = {
  name: 'Form',
  schema: formSchema,
  when: "The next step needs input the screen can't guess: change scope, compare windows, pick a branch.",
  heightClass: 'fixed',
  pickable: true,
  statesOmitted: [
    { state: 'skeleton', reason: 'A form has nothing of its own to load; a Select still waiting on options renders disabled and says so.' },
    { state: 'empty', reason: 'A composed form arrives prefilled with the screen scope, so default and filled are one picture.' },
    { state: 'warming', reason: 'An input never waits on a GitHub 202.' },
  ],
  id: { key: p => slug(p.title) },
  example: {
    title: 'Change scope',
    meta: 'vercel/next.js · v16.2',
    fields: [
      { component: 'TextInput', label: 'Repository', placeholder: 'owner/name', kind: 'identifier', validate: 'repo' },
      {
        component: 'FilterChips',
        label: 'Window',
        mode: 'single',
        options: [
          { value: '7d', label: '7 days' },
          { value: '30d', label: '30 days' },
          { value: '90d', label: '90 days' },
        ],
        selected: ['30d'],
      },
    ],
    submit: 'Ask again',
    secondary: 'Reset',
    effect: 'replaces this screen',
  },
}
