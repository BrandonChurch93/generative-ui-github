import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentState } from '../../types'
import { ContributorRank } from './ContributorRank'
import { rankPeople } from './rank'
import { contributorRankSpec, type ContributorRankProps } from './schema'
import sample from './sample.json'

afterEach(cleanup)

const props = sample.props as ContributorRankProps
const variant = (label: string) => sample.variants.find(v => v.label.startsWith(label))!.props as ContributorRankProps
const view = (state: ComponentState, extra: Partial<Parameters<typeof ContributorRank>[0]> = {}) =>
  render(
    <ContributorRank
      props={state === 'empty' ? (sample.empty as ContributorRankProps) : props}
      state={state}
      error={sample.error}
      warming={sample.warming}
      {...extra}
    />,
  )

describe('ContributorRank', () => {
  it('default: the wall above the band, the rest continuing the rank, shares of the whole window and the finding as the label', () => {
    const { container } = view('default')
    const card = screen.getByRole('region', { name: 'Two people, mira-dev and tkato, carry 52% of merged commits in the last 90 days' })
    expect(card).toBeTruthy()
    expect(screen.getByText('last 90 days · 868 commits')).toBeTruthy()
    const lists = container.querySelectorAll('ol')
    expect(lists).toHaveLength(2)
    expect(lists[0]!.querySelectorAll('[data-row]')).toHaveLength(2)
    expect(lists[1]!.getAttribute('start')).toBe('3')
    expect(container.querySelectorAll('[data-bar][data-wall]')).toHaveLength(2)
    expect(container.querySelector('[data-band-text]')?.textContent).toBe('Bus factor 2 · these two carry 52% of merged commits')
    expect([...container.querySelectorAll('[data-share]')].map(s => s.textContent)).toEqual(['31%', '21%', '12%', '9%', '7%', '5%', '4%', '2%'])
    expect(container.querySelector('[data-foot]')?.textContent).toBe('41 more authors share the other 9% · 78 commits')
    expect(screen.getByText('mira-dev, Mira Devlin, 268 merged commits, 31%')).toBeTruthy()
    expect(container.querySelector('table[data-table-view]')?.querySelectorAll('tbody tr')).toHaveLength(9)
  })

  it('skeleton: busy, placeholder rows only, no band and no accent', () => {
    const { container } = view('skeleton')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('[data-row], [data-band], [data-bar]')).toBeNull()
    expect(screen.getByText('Loading commit authors.')).toBeTruthy()
  })

  it('empty: the header, the window sentence and where the last work was, no bars or band', () => {
    const { container } = view('empty')
    expect(screen.getByText('v3 branch · last 90 days')).toBeTruthy()
    expect(screen.getByText('Nothing merged on v3 in the last 90 days')).toBeTruthy()
    expect(screen.getByText('last merge 5 months ago · v3.4.17')).toBeTruthy()
    expect(container.querySelector('[data-bar], [data-band]')).toBeNull()
  })

  it('error: the header stays, the unavailable mark and Try again, never crit', () => {
    const onRetry = vi.fn()
    const { container } = view('error', { onRetry })
    expect(screen.getByRole('heading', { name: 'Merged commits by author' })).toBeTruthy()
    expect(container.querySelector('[data-mark]')?.getAttribute('data-kind')).toBe('unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('warming: the warming row and the bottom bar filling', () => {
    const { container } = view('warming')
    expect(screen.getByText('GitHub is counting contributors')).toBeTruthy()
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.38')
  })

  it('risk: the warn mark and the system tag lead, the label leads with At risk, the bars stay data-1', () => {
    const { container } = render(<ContributorRank props={variant('Marked as risk')} state="default" />)
    expect(screen.getByRole('region', { name: 'At risk: one person, hgrey, carries 61% of reviews on merged pull requests in the last 90 days' })).toBeTruthy()
    expect(container.querySelector('[data-band] [data-mark]')?.getAttribute('data-kind')).toBe('warn')
    expect(container.querySelector('[data-band-tag]')?.textContent).toBe('at risk')
    expect(container.querySelectorAll('[data-bar][data-wall]')).toHaveLength(1)
    expect(container.querySelector('[data-foot]')).toBeNull()
  })

  it('spread out: nothing accented, the band under the last row, risk ignored without a wall', () => {
    const { container } = render(<ContributorRank props={{ ...variant('Spread out'), wallTone: 'risk' }} state="default" />)
    expect(container.querySelectorAll('ol')).toHaveLength(1)
    expect(container.querySelector('[data-bar][data-wall]')).toBeNull()
    expect(container.querySelector('[data-band-tag]')).toBeNull()
    expect(container.querySelector('[data-band-text]')?.textContent).toBe('Bus factor above 5 · the top five carry 41% of merged commits')
    expect(container.querySelector('[data-foot]')?.textContent).toBe('46 more authors share the other 59% · 243 commits')
  })

  it('a row with a follow-up question is a button that asks it and reads the row in words', () => {
    const onAsk = vi.fn()
    render(<ContributorRank props={variant('Reviews')} state="default" onAsk={onAsk} />)
    fireEvent.click(screen.getByRole('button', { name: 'ovan, Otto Vandermeer, 95 reviews, 27%' }))
    expect(onAsk).toHaveBeenCalledWith('What is ovan reviewing?')
  })

  it('the wall counts everyone, and a tie at the boundary goes to whoever was active most recently', () => {
    const tie = rankPeople({
      title: 'Merged commits by author',
      measure: 'commits',
      limit: 3,
      people: [
        { handle: 'older', count: 50, lastActive: '2026-09-01T00:00:00Z' },
        { handle: 'newer', count: 50, lastActive: '2026-10-01T00:00:00Z' },
        { handle: 'idle', count: 0 },
      ],
    })
    expect(tie.rows.map(r => r.handle)).toEqual(['newer', 'older'])
    expect(tie.busFactor).toBe(1)
    expect(tie.rows[0]!.wall).toBe(true)
  })

  it('a window where nobody did any work is the empty state, never a list of zeros', () => {
    const { container } = render(<ContributorRank props={{ ...props, people: [{ handle: 'idle', count: 0 }] }} state="default" />)
    expect(container.querySelector('[data-row]')).toBeNull()
    expect(screen.getByText('Nothing in the last 90 days')).toBeTruthy()
  })

  it('schema: the example validates, the id is the measure and window, shares are not the model to write', () => {
    expect(contributorRankSpec.schema.safeParse(contributorRankSpec.example).success).toBe(true)
    expect(contributorRankSpec.id?.key(contributorRankSpec.example!)).toBe('commits:90d')
    expect(contributorRankSpec.schema.safeParse({ ...contributorRankSpec.example, people: [] }).success).toBe(false)
    expect(contributorRankSpec.schema.safeParse({ ...contributorRankSpec.example, limit: 9 }).success).toBe(false)
  })
})
