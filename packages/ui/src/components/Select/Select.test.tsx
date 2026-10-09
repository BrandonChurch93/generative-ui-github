import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SelectProps } from './schema'
import { Select } from './Select'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as SelectProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as SelectProps
const trigger = () => screen.getByRole('combobox')
const key = (k: string) => fireEvent.keyDown(trigger(), { key: k })

describe('Select', () => {
  it('default: a combobox named by its label and its placeholder, closed', () => {
    render(<Select props={props} state="default" />)
    expect(screen.getByRole('combobox', { name: 'Milestone Choose a milestone' })).toBeTruthy()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('error: the unavailable mark and Try again, never crit', () => {
    const onRetry = vi.fn()
    const { container } = render(<Select props={props} state="error" error={sample.error} onRetry={onRetry} />)
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    expect(trigger().getAttribute('aria-invalid')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('arrow keys open and move, Enter chooses and closes', () => {
    const onChange = vi.fn()
    render(<Select props={{ ...props, onChange }} state="default" />)
    key('ArrowDown')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    const options = screen.getAllByRole('option')
    expect(trigger().getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    key('ArrowDown')
    expect(trigger().getAttribute('aria-activedescendant')).toBe(options[1]!.id)
    expect(options[1]!.textContent).toContain('3 open')
    key('Enter')
    expect(onChange).toHaveBeenCalledWith('v16.3')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('combobox', { name: 'Milestone v16.3' })).toBeTruthy()
  })

  it('Escape closes without changing; End jumps; typing finds', () => {
    render(<Select props={variant('Filled')} state="default" />)
    key('ArrowDown')
    key('End')
    expect(trigger().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[3]!.id)
    key('Escape')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('combobox', { name: 'Milestone v16.2' })).toBeTruthy()
    key('n')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(trigger().getAttribute('aria-activedescendant')!)?.textContent).toContain('No milestone')
  })

  it('a click on an option chooses it; the chosen row carries the check', () => {
    render(<Select props={variant('Filled')} state="default" />)
    fireEvent.click(trigger())
    expect(screen.getByRole('option', { selected: true }).textContent).toContain('v16.2')
    fireEvent.click(screen.getByRole('option', { name: /v17\.0/ }))
    expect(screen.getByRole('combobox', { name: 'Milestone v17.0' })).toBeTruthy()
  })

  it('invalid is crit with the system sentence; no options renders disabled with the reason', () => {
    const { container } = render(<Select props={variant('Invalid')} state="default" />)
    expect(trigger().getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('crit')
    expect(screen.getByText('Pick a milestone to ask about')).toBeTruthy()
    cleanup()
    render(<Select props={variant('No options')} state="default" />)
    expect((trigger() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('No open milestones on this repo')).toBeTruthy()
  })
})
