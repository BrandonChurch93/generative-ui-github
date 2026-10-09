import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'
import { emptyStateSchema, emptyStateSpec, type EmptyStateProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as EmptyStateProps
const variant = (label: string) => sample.variants.find(v => v.label === label)!.props as EmptyStateProps

describe('EmptyState', () => {
  it('default: the card header names what is missing; one empty row with the mark, a real sentence and the meta line', () => {
    const { container } = render(<EmptyState props={props} state="default" />)
    expect(screen.getByRole('heading', { name: 'Failing checks' })).toBeTruthy()
    expect(screen.getByText('No failing checks on canary')).toBeTruthy()
    expect(screen.getByText('last 7 days · 214 runs · last failure 9d ago')).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('good')
  })

  it('neutral when nothing to show yet; without a header the card is named by its sentence', () => {
    const { container } = render(<EmptyState props={variant('Without a header')} state="default" />)
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('neutral')
    expect(screen.getByLabelText('Nothing else to show for this question')).toBeTruthy()
    expect(container.querySelector('[data-card-head]')).toBeNull()
  })

  it('skeleton, empty, error and warming cannot happen and say why; a stray one still draws the row', () => {
    expect(emptyStateSpec.statesOmitted?.map(s => s.state)).toEqual(['skeleton', 'empty', 'error', 'warming'])
    render(<EmptyState props={props} state="error" />)
    expect(screen.getByText('No failing checks on canary')).toBeTruthy()
  })

  it('is never offered to the model, and the schema holds what the system sends', () => {
    expect(emptyStateSpec.pickable).toBe(false)
    expect(emptyStateSchema.safeParse(emptyStateSpec.example).success).toBe(true)
    expect(emptyStateSchema.safeParse({ sentence: 'Nothing here', emptyTone: 'warn' }).success).toBe(false)
  })
})
