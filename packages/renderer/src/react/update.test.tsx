import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { FIXTURES } from '../fixtures'
import { toStream } from '../format'
import { createStreamParser } from '../stream'
import { Renderer } from './Renderer'

afterEach(cleanup)

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})

const settle = () => act(async () => new Promise(r => setTimeout(r, 50)))

describe('update path', () => {
  it('counts a number and slides a new row in under the same composition, with no exit and no enter', async () => {
    const parser = createStreamParser()
    for (const op of toStream(FIXTURES.releaseBlockers)) parser.push(`${JSON.stringify(op)}\n`)
    const { container, rerender } = render(<Renderer tree={parser.tree()} reduced />)
    const metric = container.querySelector('[data-piece-id="metric:open-prs"]')
    const list = container.querySelector('[data-piece-id="statuslist:pull:milestone-v16.2"]')
    const rows = () => [...list!.querySelectorAll('[data-row]')].map(r => r.getAttribute('data-row'))

    const metricBound = FIXTURES.releaseBlockers.regions.metrics[0]!.bound as Record<string, unknown>
    const listBound = FIXTURES.releaseBlockers.regions.main[0]!.bound as { items: object[] }
    const row = { id: '84230', title: 'Script: preload the font manifest once', meta: '#84230 · nwarr · waiting 1d', state: 'pending', value: { add: 40, del: 2 } }
    parser.push(`${JSON.stringify({ op: 'update', id: 'metric:open-prs', props: { ...metricBound, value: 8 } })}\n`)
    rerender(<Renderer tree={parser.push(`${JSON.stringify({ op: 'update', id: 'statuslist:pull:milestone-v16.2', props: { ...listBound, items: [row, ...listBound.items] } })}\n`)} reduced />)

    expect(container.querySelector('[data-piece-id="metric:open-prs"]')).toBe(metric)
    expect(container.querySelector('[data-piece-id="statuslist:pull:milestone-v16.2"]')).toBe(list)
    expect(rows()[0]).toBe('84230')
    await settle()
    expect(metric!.querySelector('[data-number]')!.textContent).toBe('8')
    expect(container.querySelectorAll('[data-piece-id]')).toHaveLength(8)
  })
})

