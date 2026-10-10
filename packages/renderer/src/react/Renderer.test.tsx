import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { registry } from '@genui-github/ui'
import { catalogEntry } from '@genui-github/ui/catalog'
import { FIXTURES } from '../fixtures'
import type { Composition, Piece } from '../format'
import { PIECES } from '@genui-github/ui/pieces'
import { Conductor } from './conductor'
import { Renderer, REGION_FAILED } from './Renderer'

afterEach(cleanup)

// jsdom has no layout; the charts only use it to pick tick counts.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

const one = FIXTURES.releaseBlockers
const pieceIds = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-piece-id]')].map(el => el.dataset.pieceId)

function sampled(component: string, extra: Record<string, unknown> = {}): Piece {
  const props = registry.get(component)!.example
  return { id: registry.deriveId(component, props), component, props, bound: { ...(catalogEntry(component)!.sample.props as object), ...extra } }
}

describe('Renderer', () => {
  it('renders fixture 1, every piece keyed by its stable id, in reading order', () => {
    const { container } = render(<Renderer composition={one} reduced />)
    expect(pieceIds(container)).toEqual([
      'insight:answer',
      'metric:open-prs',
      'metric:awaiting-review',
      'metric:failing-checks',
      'metric:milestone-issues-open',
      'statuslist:pull:milestone-v16.2',
      'linechart:ci-p50',
      'actioncard:request-review:#84120+#84156+#84201',
    ])
    expect(container.querySelector('[data-density]')?.getAttribute('data-density')).toBe('comfortable')
  })

  it('renders the other pieces when one is bad, and the bad one as an error card with its frame', () => {
    const bad: Composition = { ...one, regions: { ...one.regions, side: [{ id: 'gauge:x', component: 'Gauge', props: {} }] } }
    const { container } = render(<Renderer composition={bad} reduced />)
    expect(pieceIds(container)).toHaveLength(8)
    const card = container.querySelector('[data-piece-id="gauge:x"]')!
    expect(card.getAttribute('data-state')).toBe('error')
    expect(card.textContent).toContain('Gauge is not a component this screen knows')
    expect(container.querySelector('[data-piece-id="metric:failing-checks"] [data-number]')?.textContent).toBe('1')
  })

  it('emits { ask, from } for a piece ask, a day heading, a heatmap cell and a source chip', () => {
    const onAsk = vi.fn()
    const composition: Composition = {
      ...one,
      regions: { ...one.regions, main: [sampled('Timeline', { dayAsk: 'What merged on {day}?' })], side: [sampled('Heatmap')] },
    }
    const { container } = render(<Renderer composition={composition} reduced onAsk={onAsk} />)
    const within = (id: string) => container.querySelector(`[data-piece-id="${id}"]`)!
    fireEvent.click(within('metric:failing-checks').querySelector('button')!)
    fireEvent.click(within(composition.regions.main[0]!.id).querySelector('h3 button')!)
    fireEvent.click(within(composition.regions.side[0]!.id).querySelector('td button, [role="gridcell"] button, button[aria-label*="Mon"]')!)
    const chip = [...within('insight:answer').querySelectorAll('button')].find(b => b.textContent === '14 check runs')!
    fireEvent.click(chip)
    expect(onAsk.mock.calls.map(([e]) => e.from)).toEqual(['metric:failing-checks', composition.regions.main[0]!.id, composition.regions.side[0]!.id, 'insight:answer'])
    expect(onAsk.mock.calls[0]![0].ask).toBe('Which checks are failing on canary?')
    expect(onAsk.mock.calls[1]![0].ask).toMatch(/^What merged on .+\?$/)
    expect(onAsk.mock.calls[2]![0].ask).toMatch(/reviewed on \w+s around/)
    expect(onAsk.mock.calls[3]![0].ask).toBe('Which checks are failing on canary?')
  })

  it('keeps the survivor node through a rewrite and lets the leavers finish their exit before unmounting', async () => {
    const { container, rerender } = render(<Renderer composition={one} reduced />)
    const before = container.querySelector('[data-piece-id="metric:failing-checks"]')
    rerender(<Renderer composition={FIXTURES.checkFailures} reduced />)
    expect(container.querySelector('[data-piece-id="metric:failing-checks"]')).toBe(before)
    expect(container.querySelector('[data-piece-id="metric:open-prs"]')).not.toBeNull()
    await act(async () => {
      await new Promise(r => setTimeout(r, 1500))
    })
    expect(container.querySelector('[data-piece-id="metric:open-prs"]')).toBeNull()
    expect(container.querySelector('[data-piece-id="metric:failing-checks"] [data-number]')?.textContent).toBe('2')
  })
})

describe('Renderer follow-up', () => {
  const wait = (ms: number) => act(async () => new Promise(r => setTimeout(r, ms)))
  const frame = (root: HTMLElement, id: string) => root.querySelector(`[data-piece-id="${id}"]`)

  it('starts the exits on the ask, keeps the clicked piece, and lets an answer that arrives in time morph survivors in place', async () => {
    const { container, rerender } = render(<Renderer composition={one} reduced />)
    const [kept, chart] = [frame(container, 'metric:failing-checks'), frame(container, 'linechart:ci-p50')]
    rerender(<Renderer composition={one} reduced awaiting anchor="metric:failing-checks" />)
    expect(container.querySelector('[data-composition]')?.getAttribute('data-composition')).toBe('awaiting')
    expect(pieceIds(container)).toHaveLength(8)
    rerender(<Renderer composition={FIXTURES.checkFailures} reduced />)
    expect(frame(container, 'metric:failing-checks')).toBe(kept)
    expect(frame(container, 'linechart:ci-p50')).toBe(chart)
    await wait(1500)
    expect(container.querySelector('[data-state="skeleton"]')).toBeNull()
    expect(frame(container, 'metric:open-prs')).toBeNull()
    expect(frame(container, 'metric:failing-checks')?.hasAttribute('data-left')).toBe(false)
    expect(frame(container, 'metric:failing-checks')?.querySelector('[data-number]')?.textContent).toBe('2')
  })

  it('shows the answer frame as a skeleton once the old answer has gone, and fills that frame when the answer lands', async () => {
    const { container, rerender } = render(<Renderer composition={one} reduced />)
    rerender(<Renderer composition={one} reduced awaiting />)
    await wait(1500)
    const skeleton = container.querySelector<HTMLElement>('[data-region="insight"] [data-piece-id]')!
    expect(skeleton.dataset.state).toBe('skeleton')
    expect(frame(container, 'insight:answer')).toBeNull()
    expect(frame(container, 'metric:open-prs')?.getAttribute('data-left')).not.toBeNull()
    rerender(<Renderer composition={FIXTURES.checkFailures} reduced />)
    expect(frame(container, 'insight:answer')).toBe(skeleton)
    await wait(1500)
    expect(skeleton.dataset.state).toBe('default')
    expect(frame(container, 'metric:open-prs')).toBeNull()
    expect(container.querySelector('[data-left]')).toBeNull()
  })
})

describe('Renderer error boundaries', () => {
  it('draws every other region when a component throws inside one region', () => {
    const real = PIECES.LineChart!.Component
    PIECES.LineChart!.Component = (() => {
      throw new Error('the chart broke')
    }) as typeof real
    try {
      const { container } = render(<Renderer composition={one} reduced />)
      const side = container.querySelector('[data-region="side"]')!
      expect(side.querySelector('[data-piece-id="linechart:ci-p50"]')?.getAttribute('data-piece-id')).toBe('linechart:ci-p50')
      expect(side.textContent).toContain("Couldn't")
      for (const region of ['insight', 'metrics', 'main', 'action']) expect(container.querySelector(`[data-region="${region}"] [data-piece-id]`), region).not.toBeNull()
    } finally {
      PIECES.LineChart!.Component = real
    }
  })

  it('draws every other region when a move throws in one region, and says so in the system words', () => {
    const motion = Conductor.prototype.motion
    const spy = vi.spyOn(Conductor.prototype, 'motion').mockImplementation(function (this: Conductor, ...args: Parameters<Conductor['motion']>) {
      if (args[3]?.startsWith('linechart')) throw new Error('the move broke')
      return motion.apply(this, args)
    })
    try {
      const { container } = render(<Renderer composition={one} reduced />)
      expect(container.querySelector('[data-region="side"]')!.textContent).toContain(REGION_FAILED)
      expect(container.querySelector('[data-region="side"] [data-piece-id]')).toBeNull()
      for (const region of ['insight', 'metrics', 'main', 'action']) expect(container.querySelector(`[data-region="${region}"] [data-piece-id]`), region).not.toBeNull()
    } finally {
      spy.mockRestore()
    }
  })
})
