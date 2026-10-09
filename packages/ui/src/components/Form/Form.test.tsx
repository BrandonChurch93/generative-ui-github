import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Form } from './Form'
import { formSchema, formSpec, type FormProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as FormProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as FormProps

describe('Form', () => {
  it('default: a real form named by its title, prefilled fields, the actions row', () => {
    render(<Form props={props} state="default" />)
    expect(screen.getByRole('form', { name: 'Change scope' })).toBeTruthy()
    expect((screen.getByLabelText('Repository') as HTMLInputElement).value).toBe('vercel/next.js')
    expect(screen.getByRole('combobox', { name: 'Milestone v16.2' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Window' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '30 days, 188' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('replaces this screen')).toBeTruthy()
  })

  it('error: the effect line becomes the unreachable line, never crit, and the fields stay unlocked', () => {
    const onRetry = vi.fn()
    const { container } = render(<Form props={props} state="error" error={sample.error} onRetry={onRetry} />)
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText("Couldn't ask again")).toBeTruthy()
    expect(screen.queryByText('replaces this screen')).toBeNull()
    expect((screen.getByLabelText('Repository') as HTMLInputElement).readOnly).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('a repo GitHub could not find is crit; the milestone that depends on it waits, disabled', () => {
    render(<Form props={variant('Repo not found · milestone waits')} state="default" />)
    expect(screen.getByLabelText('Repository').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText("That repo is private or doesn't exist")).toBeTruthy()
    const milestone = screen.getByRole('combobox') as HTMLButtonElement
    expect(milestone.disabled).toBe(true)
    expect(milestone.getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByText('Milestones load once the repo checks out')).toBeTruthy()
  })

  it('submit validates, moves focus to the first invalid field, then sends the values', () => {
    const onSubmit = vi.fn()
    render(<Form props={{ ...props, onSubmit }} state="default" />)
    const repo = screen.getByLabelText('Repository')
    fireEvent.change(repo, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask again' }))
    expect(screen.getByText('Paste a public GitHub repo')).toBeTruthy()
    expect(document.activeElement).toBe(repo)
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.change(repo, { target: { value: 'vercel/turborepo' } })
    fireEvent.click(screen.getByRole('radio', { name: '90 days, 521' }))
    fireEvent.submit(screen.getByRole('form'))
    expect(onSubmit).toHaveBeenCalledWith({ repository: 'vercel/turborepo', milestone: 'v16.2', window: ['90d'] })
    expect(screen.getByRole('button', { name: 'Ask again' }).getAttribute('aria-busy')).toBe('true')
    expect((repo as HTMLInputElement).readOnly).toBe(true)
  })

  it('Reset restores the values the form arrived with', () => {
    render(<Form props={props} state="default" />)
    const repo = screen.getByLabelText('Repository') as HTMLInputElement
    fireEvent.change(repo, { target: { value: 'vercel/turborepo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(repo.value).toBe('vercel/next.js')
  })
})

describe('formSchema', () => {
  const field = (extra: object) => ({ component: 'TextInput', label: 'Repository', kind: 'identifier', validate: 'repo', ...extra })
  const form = (fields: object[], extra: object = {}) => ({ title: 'Change scope', fields, submit: 'Ask again', effect: 'replaces this screen', ...extra })

  it('accepts the registry example', () => {
    expect(formSchema.safeParse(formSpec.example).success).toBe(true)
  })

  it('rejects what the model may not send', () => {
    const chips = { component: 'FilterChips', label: 'Window', mode: 'single', options: [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }] }
    const select = { component: 'Select', label: 'Milestone', options: [{ value: 'v16.2', label: 'v16.2' }] }
    const bad = [
      form([field({}), field({ label: 'Branch' }), field({ label: 'Handle' }), field({ label: 'Base' }), field({ label: 'Head' })]),
      form([{ ...field({}), component: 'DatePicker' }]),
      form([field({ placeholder: 'owner/name', className: 'wide' })]),
      form([{ ...chips, selected: ['7d', '30d'] }]),
      form([{ ...select, value: 'v99' }]),
      form([{ ...select, value: 'v16.2', options: [{ value: 'v16.2', label: 'v16.2', meta: '7 open' }] }]),
      form([field({}), field({})]),
      form([field({})], { secondary: 'Delete' }),
    ]
    for (const props of bad) expect(formSchema.safeParse(props).success, JSON.stringify(props)).toBe(false)
  })
})
