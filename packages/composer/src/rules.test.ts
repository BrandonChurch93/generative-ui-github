import { describe, expect, it } from 'vitest'
import { createLogger } from '@genui-github/core'
import { NUMBER_MISMATCH_SENTENCE } from '@genui-github/ui'
import { toScreen, type Composition, type Piece } from '@genui-github/renderer'
import releaseBlockers from '@genui-github/renderer/fixtures/1-release-blockers.json'
import contributors from '@genui-github/renderer/fixtures/3-contributors.json'
import { densityFor, enforceRules, isAnswerable } from './rules'

const quiet = createLogger('test', { sink: () => {} })
const one = releaseBlockers as Composition
const three = contributors as Composition
const run = (c: Composition, question?: string) => enforceRules(c, { log: quiet, question })
const rules = (c: Composition, question?: string) => run(c, question).drops.map(d => d.rule)
const withRegions = (base: Composition, regions: Partial<Composition['regions']>): Composition => ({ ...base, regions: { ...base.regions, ...regions } })
const metric = (base: Piece, measure: string, extra: Record<string, unknown> = {}): Piece => ({
  ...base,
  id: `metric:${measure}`,
  props: { ...(base.props as object), measure, ...extra },
  bound: { ...(base.bound as object), measure, ...extra },
})

describe('composition rules', () => {
  it('keeps a composition that breaks none', () => {
    expect(run(one, "What's blocking the next release?").drops).toEqual([])
  })

  it('1 · the insight is always the first piece', () => {
    expect(rules(withRegions(one, { insight: [] }))).toEqual(['the insight is always the first piece'])
  })

  it('2 · at most four metrics, at most two hot', () => {
    const [a] = one.regions.metrics
    expect(rules(withRegions(one, { metrics: [...one.regions.metrics, metric(a!, 'stars')] }))).toContain('metrics holds at most 4')
    const hot = [metric(a!, 'stars', { hot: true }), metric(a!, 'commits', { hot: true }), metric(a!, 'contributors', { hot: true })]
    expect(rules(withRegions(one, { metrics: hot }))).toEqual(['at most two metrics are hot'])
  })

  it('3 · at most one ActionCard', () => {
    const second = { ...one.regions.action[0]!, id: 'actioncard:comment:#84120', props: { ...(one.regions.action[0]!.props as object), effect: { kind: 'comment', targets: ['#84120'] } } }
    expect(rules(withRegions(one, { action: [...one.regions.action, second] }))).toEqual(['action holds at most 1'])
  })

  it('4 · two grows pieces never share a row in a free composition; a designed template may pair them', () => {
    const paired = withRegions(one, { side: three.regions.main })
    expect(rules({ ...paired, built: { ...paired.built, template: 'off-template' } })).toEqual(['two grows pieces never share a row'])
    expect(rules(paired)).toEqual([])
  })

  it("5 · a metric never repeats the rank band's words or a comparison's verdict", () => {
    const busFactor = three.regions.metrics.find(p => p.id === 'metric:bus-factor')!
    const repeats = metric(busFactor, 'bus-factor', { delta: 'these two carry 61%' })
    expect(rules(withRegions(three, { metrics: [repeats] }))).toEqual(["a metric never repeats the rank band's words"])
    const comparison: Piece = { id: 'comparison:x', component: 'Comparison', props: {} }
    const verdict = metric(one.regions.metrics[0]!, 'open-prs', { delta: 'better than last month' })
    expect(rules(withRegions(one, { metrics: [verdict], side: [comparison] }))).toContain("a metric never repeats a comparison's verdict")
  })

  it('6 · a Steps ask never recomposes a list already on screen', () => {
    const steps: Piece = {
      id: 'steps:x',
      component: 'Steps',
      props: { title: 'Start here', steps: [{ id: 'a', title: 'Pick a pull request', body: 'Start small.', link: { label: 'Show them', ask: 'Show me the milestone pull requests' } }] },
    }
    const { composition, drops } = run(withRegions(one, { main: [...one.regions.main, steps] }))
    expect(drops.map(d => d.rule)).toEqual(['a Steps ask never recomposes a list already on screen'])
    expect((composition.regions.main[1]!.props as { steps: object[] }).steps[0]).not.toHaveProperty('link')
  })

  it('7 · two series at most on a chart: a third fails the schema and renders the error state', () => {
    const chart = one.regions.side[0]!
    const props = chart.props as { series: object[] }
    const three = { ...chart, props: { ...props, series: [...props.series, ...props.series, ...props.series] } }
    const screen = toScreen(withRegions(one, { side: [three] }), { log: quiet })
    expect(screen.regions.side[0]!.state).toBe('error')
  })

  it('8 · a number the data does not hold never renders', () => {
    const insight = one.regions.insight[0]!
    const lying = { ...insight, bound: { ...(insight.bound as object), sentence: 'v16.2 is held by nine pull requests.' } }
    expect(toScreen(withRegions(one, { insight: [lying] }), { log: quiet }).regions.insight[0]!.props).toMatchObject({ sentence: NUMBER_MISMATCH_SENTENCE })
  })

  it('9 · density follows the question', () => {
    expect([densityFor('quick version: is CI slower?'), densityFor('walk me through the release'), densityFor('Is CI getting slower?')]).toEqual(['compact', 'spacious', 'comfortable'])
    expect(run(one, 'give me the quick version').composition.density).toBe('compact')
  })

  it('10 · follow-up asks must be answerable by a template', () => {
    const asks = [...one.asks.slice(0, 2), { label: 'Weather', ask: 'Will it rain in Lisbon?' }]
    expect(rules({ ...one, asks })).toEqual(['a follow-up ask must be answerable by a template'])
    expect(['Which checks are failing on canary?', "What's holding #84120?", 'What has sokra been working on?'].every(isAnswerable)).toBe(true)
  })
})
