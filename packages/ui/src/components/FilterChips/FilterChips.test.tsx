import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterChips, fitChips } from './FilterChips'
import type { FilterChipsProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as FilterChipsProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as unknown as FilterChipsProps

describe('FilterChips', () => {
  it('default: a named group of toggles, each count part of the chip name', () => {
    render(<FilterChips props={props} state="default" />)
    expect(screen.getByRole('group', { name: 'Filter v16.2 pull requests by area' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Turbopack, 3' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Cache, 1' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('skeleton: labels at once, counts as blocks, busy with one hidden sentence', () => {
    const { container } = render(<FilterChips props={props} state="skeleton" />)
    expect(screen.getByRole('group').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Counting what each filter would show.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Turbopack' })).toBeTruthy()
    expect(container.querySelector('[data-count]')).toBeNull()
  })

  it('a failed target drops the counts and disables the chips; the chosen keep their state', () => {
    render(<FilterChips props={props} state="error" />)
    const turbopack = screen.getByRole('button', { name: 'Turbopack' }) as HTMLButtonElement
    expect(turbopack.disabled).toBe(true)
    expect(turbopack.getAttribute('aria-pressed')).toBe('true')
  })

  it('multi toggles in option order; a zero stays visible and enabled', () => {
    const onChange = vi.fn()
    render(<FilterChips props={{ ...variant('A zero stays visible'), selected: ['router'], onChange }} state="default" />)
    const docs = screen.getByRole('button', { name: 'Docs, 0' }) as HTMLButtonElement
    expect(docs.disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Turbopack, 3' }))
    expect(onChange).toHaveBeenLastCalledWith(['turbopack', 'router'])
    fireEvent.click(screen.getByRole('button', { name: 'Router, 2' }))
    expect(onChange).toHaveBeenLastCalledWith(['turbopack'])
  })

  it('single is a radio group with one tab stop; arrow keys move and choose', () => {
    render(<FilterChips props={variant('Single · window')} state="default" />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
    const thirty = screen.getByRole('radio', { name: '30 days, 188' })
    expect(thirty.getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('radio').map(r => r.tabIndex)).toEqual([-1, 0, -1])
    fireEvent.keyDown(thirty, { key: 'ArrowRight' })
    const ninety = screen.getByRole('radio', { name: '90 days, 521' })
    expect(ninety.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(ninety)
  })
})

describe('fitChips', () => {
  const widths = [50, 80, 90, 70, 120, 100, 60]
  it('fills in order behind room for "+N more", and returns null when all fit', () => {
    expect(fitChips(widths, widths.map((_, i) => i === 0), 300, 8, 60)).toEqual(new Set([0, 1]))
    expect(fitChips([50, 60], [false, false], 300, 8, 60)).toBeNull()
  })

  it('pulls a chosen chip forward so it never hides', () => {
    expect(fitChips(widths, widths.map((_, i) => i === 6), 300, 8, 60)).toEqual(new Set([6, 0, 1]))
  })
})
