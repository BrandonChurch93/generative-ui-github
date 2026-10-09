// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw, without } from './group-b-testing'
import { bindHeatmap, systemSummary } from './Heatmap'

afterEach(cleanup)

const commits = { title: 'When does sokra commit', unit: 'commits' as const, window: '12w' as const, summary: 'x', cellAsk: 'What landed on {weekday} around {hour}?' }

describe('bindHeatmap', () => {
  it('fills the repo-wide punch card, keeps the repo-wide title and writes a summary the plot accepts', async () => {
    const ctx = await nextContext()
    const summary = systemSummary(ctx, commits)
    expect(summary).toBe('Commits peak on Tuesday at 09:00, 302 in that hour; Sunday is the quietest day.')
    const { node, warnings } = check(bindHeatmap(ctx, { ...commits, summary }))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const props = node.props as { title: string; counts: number[][]; zone: string; cellAsk: string }
    expect(props.title).toBe('When commits land')
    expect(props.counts).toHaveLength(7)
    expect(props.counts[1]![9]).toBe(302)
    expect(props.zone).toBe('PDT')
    expect(props.cellAsk).toBe(commits.cellAsk)
    const { container } = draw(node)
    expect(container.querySelector('[data-plot]')?.getAttribute('aria-label')).toBe(summary)
  })

  it('will not count reviews over weeks the capped pull list does not reach', async () => {
    const { node } = check(bindHeatmap(await nextContext(), { ...commits, unit: 'reviews' }))
    expect(node.state).toBe('error')
    expect(node.error).toEqual({ failed: "Couldn't count reviews by hour", cause: 'The pull request list reaches back to Oct 1 only' })
  })

  it('is an error when the punch card was not fetched', async () => {
    const { node } = check(bindHeatmap(without(await nextContext(), 'stats.punchCard'), commits))
    expect(node.error).toEqual({ failed: "Couldn't load commits by hour", cause: "Not in this answer's data" })
  })
})
