import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardFrame, Mark, MARK_KINDS, RepoChip, Segmented, Skeleton, SkeletonBlock, Spine, StateRow, Tag, TextLink } from './index'

afterEach(cleanup)

describe('parts', () => {
  it('Mark draws every kind and hides itself from assistive tech', () => {
    const { container } = render(<>{MARK_KINDS.map(k => <Mark key={k} kind={k} />)}</>)
    const marks = container.querySelectorAll('[data-mark]')
    expect([...marks].map(m => m.getAttribute('data-kind'))).toEqual([...MARK_KINDS])
    expect([...marks].every(m => m.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('Tag carries its tone and the words', () => {
    render(<Tag tone="crit">Changes requested</Tag>)
    expect(screen.getByText('Changes requested').getAttribute('data-tone')).toBe('crit')
  })

  it('TextLink is a link with href and a button without', () => {
    const onClick = vi.fn()
    render(
      <>
        <TextLink href="/source">Source</TextLink>
        <TextLink onClick={onClick}>Try again</TextLink>
      </>,
    )
    expect(screen.getByRole('link', { name: 'Source' }).getAttribute('href')).toBe('/source')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('CardFrame names itself by its title and draws the warming bar', () => {
    const { container } = render(
      <CardFrame title="Open pull requests" meta="v16.2" headerEnd={<span>Table</span>} progress={0.4}>
        body
      </CardFrame>,
    )
    expect(screen.getByRole('region', { name: 'Open pull requests' })).toBeTruthy()
    expect(container.querySelector('[data-progress]')?.getAttribute('style')).toContain('--progress: 0.4')
  })

  it('Skeleton renders text lines and shapes as hidden placeholders', () => {
    const { container } = render(
      <>
        <Skeleton text="row-title" width="60%" />
        <SkeletonBlock width="100%" height="var(--bar)" />
      </>,
    )
    const blocks = container.querySelectorAll('[data-skeleton]')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.getAttribute('style')).toContain('--sk-size: var(--text-row-title-size)')
  })

  it('StateRow picks its mark from the state, never crit for an error', () => {
    const { container } = render(
      <>
        <StateRow kind="error" title="Couldn't load pull requests" meta="GitHub returned 502" />
        <StateRow kind="empty" emptyTone="good" title="No reverts in the last 14 days" />
        <StateRow kind="warming" title="GitHub is counting contributors" meta="Checking again in 4s" />
      </>,
    )
    const kinds = [...container.querySelectorAll('[data-mark]')].map(m => m.getAttribute('data-kind'))
    expect(kinds).toEqual(['unavailable', 'good', 'warming'])
  })

  it('Spine takes its geometry from the host', () => {
    const { container } = render(<Spine top="20px" bottom="30px" />)
    expect(container.querySelector('[data-spine]')?.getAttribute('style')).toContain('--spine-top: 20px')
  })

  it('RepoChip links when given an href and marks the selection', () => {
    render(<RepoChip repo="vercel/next.js" href="/r/vercel/next.js" selected />)
    expect(screen.getByRole('link', { name: 'vercel/next.js' }).getAttribute('aria-current')).toBe('true')
  })

  it('Segmented selects by click and arrow keys and skips disabled segments', () => {
    const onChange = vi.fn()
    render(
      <Segmented
        label="State"
        value="default"
        onChange={onChange}
        options={[
          { value: 'default', label: 'Default' },
          { value: 'warming', label: 'Warming', disabled: true, reason: 'Never waits on GitHub.' },
          { value: 'error', label: 'Error' },
        ]}
      />,
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    act(() => {
      fireEvent.keyDown(radios[0]!, { key: 'ArrowRight' })
    })
    expect(onChange).toHaveBeenLastCalledWith('error')
    fireEvent.click(radios[1]!)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
