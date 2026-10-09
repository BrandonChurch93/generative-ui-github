import { chipCounts } from './FilterChips'
import type { Form } from '@genui-github/ui/schemas'
import { bound, type Binder, type DataContext } from './types'

type FormModel = Form.FormModelProps
type FieldModel = FormModel['fields'][number]
type TextField = Extract<FieldModel, { component: 'TextInput' }>
type SelectField = Extract<FieldModel, { component: 'Select' }>

const COMPONENT = 'Form'

function textValue(ctx: DataContext, field: TextField): string | undefined {
  if (field.validate === 'repo') return `${ctx.repo.owner}/${ctx.repo.name}`
  if (field.validate === 'branch') return ctx.repo.defaultBranch
  if (field.validate === 'handle') return ctx.scope?.author
  return undefined
}

/** An option that names an open milestone carries its open count, the one count a Select option shows. */
function selectOptions(ctx: DataContext, field: SelectField) {
  const milestones = ctx.shapes.milestones?.open ?? []
  return field.options.map(o => {
    const m = milestones.find(x => x.title === o.value)
    return m ? { ...o, meta: `${m.open.toLocaleString('en-US')} open` } : o
  })
}

function bindField(ctx: DataContext, field: FieldModel): Form.FormField {
  if (field.component === 'TextInput') {
    const value = textValue(ctx, field)
    return value ? { ...field, value } : field
  }
  if (field.component === 'Select') return { ...field, options: selectOptions(ctx, field) }
  // Chips in a form have no card below them; with nothing to count they show their labels alone, never a count that would be wrong.
  const found = chipCounts(ctx, undefined, field.options)
  return found ? { ...field, ...found } : { ...field, counts: {} }
}

/** The model's fields and words, each field arriving with the screen's current scope. Submit and Cancel are the renderer's. */
export const bindForm: Binder<FormModel> = (ctx, props, extras = {}) =>
  bound(COMPONENT, props, { ...props, fields: props.fields.map(f => bindField(ctx, f)) } satisfies Form.FormProps, extras)
