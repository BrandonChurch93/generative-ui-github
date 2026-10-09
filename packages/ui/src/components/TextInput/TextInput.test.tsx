import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkValue, type TextInputProps } from './schema'
import { TextInput } from './TextInput'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as TextInputProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as TextInputProps

describe('TextInput', () => {
  it('default: a real label, the helper tied to the field, identifier attributes', () => {
    render(<TextInput props={props} state="default" />)
    const input = screen.getByLabelText('Repository') as HTMLInputElement
    expect(input.placeholder).toBe('owner/name')
    expect(input.getAttribute('spellcheck')).toBe('false')
    expect(input.getAttribute('autocapitalize')).toBe('none')
    const slot = document.getElementById(input.getAttribute('aria-describedby')!)
    expect(slot?.textContent).toBe('Any public repo, as owner/name or a github.com link')
  })

  it('error: GitHub failing is the unavailable mark and ink words, never crit, with Try again', () => {
    const onRetry = vi.fn()
    const { container } = render(<TextInput props={props} state="error" error={sample.error} onRetry={onRetry} />)
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(screen.getByText("Couldn't check this repo")).toBeTruthy()
    expect(screen.getByText('· GitHub returned 502')).toBeTruthy()
    expect(screen.getByLabelText('Repository').getAttribute('aria-invalid')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('a missing repo is invalid: crit mark, aria-invalid and the system sentence', () => {
    const { container } = render(<TextInput props={variant('Invalid')} state="default" />)
    expect(screen.getByLabelText('Repository').getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('crit')
    expect(screen.getByText("That repo is private or doesn't exist")).toBeTruthy()
  })

  it('checking keeps the value readable and read only, with the warming mark', () => {
    render(<TextInput props={variant('Checking')} state="default" />)
    const input = screen.getByLabelText('Repository') as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Checking vercel/next.js on GitHub')).toBeTruthy()
  })

  it('blur checks what was typed; editing clears the verdict', () => {
    render(<TextInput props={props} state="default" />)
    const input = screen.getByLabelText('Repository')
    fireEvent.change(input, { target: { value: 'vercel' } })
    fireEvent.blur(input)
    expect(screen.getByText('Needs owner/name, like vercel/next.js')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'vercel/next.js' } })
    expect(input.getAttribute('aria-invalid')).toBeNull()
  })

  it('hero: hidden label, validates on submit, then hands over the trimmed value', () => {
    const onSubmit = vi.fn()
    render(<TextInput props={{ ...variant('Hero'), onSubmit }} state="default" />)
    const input = screen.getByLabelText('Public GitHub repository')
    expect(input.getAttribute('inputmode')).toBe('url')
    fireEvent.change(input, { target: { value: 'https://gitlab.com/x/y' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open repo' }))
    expect(screen.getByText('Only github.com repos')).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '  vercel/next.js  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open repo' }))
    expect(onSubmit).toHaveBeenCalledWith('vercel/next.js')
  })

  it('hero: a value set by the host replaces the typed one, and a resolved value shows a check in the system words', () => {
    const hero = variant('Hero')
    const { rerender } = render(<TextInput props={hero} state="default" />)
    const input = screen.getByLabelText<HTMLInputElement>('Public GitHub repository')
    fireEvent.change(input, { target: { value: 'half typed' } })
    rerender(<TextInput props={{ ...hero, value: 'vercel/next.js', status: { kind: 'resolved', value: 'vercel/next.js' } }} state="default" />)
    expect(input.value).toBe('vercel/next.js')
    const line = screen.getByText('Found vercel/next.js on GitHub · ready for a question').closest('[data-kind]')!
    expect(line.getAttribute('data-kind')).toBe('resolved')
    expect(line.querySelector('[data-check]')).toBeTruthy()
  })
})

describe('checkValue', () => {
  it('reads repos the way the resolver does', () => {
    const cases: [string, string | undefined][] = [
      ['vercel/next.js', undefined],
      ['https://github.com/vercel/next.js', undefined],
      ['https://github.com/vercel/next.js/pulls', undefined],
      ['github.com/vercel/next.js.git', undefined],
      ['  Vercel/Next.js  ', undefined],
      ['vercel', 'repo-shape'],
      ['vercel/next.js/extra/deep', undefined],
      ['https://gitlab.com/x/y', 'repo-host'],
      ['', 'required'],
      ['-vercel/next.js', 'repo-format'],
    ]
    for (const [input, problem] of cases) expect(checkValue('repo', input), input).toBe(problem)
  })

  it('checks branches and handles, and an optional empty field passes', () => {
    expect(checkValue('branch', 'canary')).toBeUndefined()
    expect(checkValue('branch', 'feat..x')).toBe('branch-format')
    expect(checkValue('handle', '@mira-dev')).toBeUndefined()
    expect(checkValue('handle', 'mira--dev')).toBe('handle-format')
    expect(checkValue('repo', ' ', false)).toBeUndefined()
  })
})
