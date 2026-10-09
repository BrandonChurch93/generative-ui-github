import { describe, expect, it } from 'vitest'
import { createLogger, type LogRecord } from '@genui-github/core'
import { NUMBER_MISMATCH_SENTENCE } from '@genui-github/ui'
import { FIXTURES } from './fixtures'
import type { Composition, Piece } from './format'
import { toScreen } from './screen'

function capture() {
  const records: LogRecord[] = []
  return { records, log: createLogger('test', { level: 'debug', sink: r => records.push(r) }) }
}

const base = FIXTURES.releaseBlockers
const withRegions = (patch: Partial<Composition['regions']>): Composition => ({ ...base, regions: { ...base.regions, ...patch } })

describe('validation and fallback', () => {
  it('renders every fixture piece in its default state, with nothing logged', () => {
    for (const composition of Object.values(FIXTURES)) {
      const { records, log } = capture()
      const screen = toScreen(composition, { log })
      expect(records).toEqual([])
      const nodes = Object.values(screen.regions).flat()
      expect(nodes.every(n => n.state === 'default')).toBe(true)
    }
  })

  it('turns an unknown component, failing props and missing data into error pieces, logs each, and renders the rest', () => {
    const { records, log } = capture()
    const unknown: Piece = { id: 'gauge:x', component: 'Gauge', props: {} }
    const badProps: Piece = { ...base.regions.metrics[0]!, props: { measure: 'not-a-measure' } }
    const noData: Piece = { ...base.regions.metrics[1]!, bound: undefined }
    const screen = toScreen(withRegions({ metrics: [badProps, noData, base.regions.metrics[2]!], side: [unknown] }), { log })

    const states = screen.regions.metrics.map(n => [n.state, n.error?.cause])
    expect(states).toEqual([
      ['error', 'The composer sent a description that failed validation'],
      ['error', 'Its data never arrived'],
      ['default', undefined],
    ])
    expect(screen.regions.side).toMatchObject([{ state: 'error', unknown: true, error: { cause: 'Gauge is not a component this screen knows' } }])
    expect(screen.regions.main[0]!.state).toBe('default')
    expect(records.map(r => r.message)).toEqual([
      'props failed the component schema',
      'piece has no data after the composition finished',
      'unknown component',
    ])
  })

  it('shows a skeleton for a piece whose data has not arrived while the stream is still open', () => {
    const screen = toScreen({ asks: [], regions: { ...base.regions, metrics: [{ ...base.regions.metrics[0]!, bound: undefined }] }, done: false })
    expect(screen.regions.metrics[0]!.state).toBe('skeleton')
  })

  it('replaces prose whose numbers the cited data does not hold', () => {
    const { log } = capture()
    const insight = base.regions.insight[0]!
    const lying = { ...insight, bound: { ...(insight.bound as object), sentence: 'v16.2 is held by five pull requests.' } }
    const delta = { ...base.regions.metrics[0]!, bound: { ...(base.regions.metrics[0]!.bound as object), delta: '9 merged this week' } }
    const screen = toScreen(withRegions({ insight: [lying], metrics: [delta] }), { log })
    expect(screen.regions.insight[0]!.props).toMatchObject({ sentence: NUMBER_MISMATCH_SENTENCE })
    expect(screen.regions.metrics[0]!.props).not.toHaveProperty('delta')
  })

  it('drops pieces that break a composition rule and keeps the rest', () => {
    const { records, log } = capture()
    const [a, b, c, d] = base.regions.metrics
    const hot = (p: Piece, measure: string): Piece => ({ ...p, id: `metric:${measure}`, props: { ...(p.props as object), measure, hot: true }, bound: { ...(p.bound as object), hot: true } })
    const rank = FIXTURES.contributors.regions.main[0]!
    const screen = toScreen(
      withRegions({
        metrics: [a!, b!, c!, hot(d!, 'milestone-issues-open'), hot(a!, 'stars')],
        side: [rank],
        action: [...base.regions.action, { ...base.regions.action[0]!, id: 'actioncard:comment:#84120', props: { ...(base.regions.action[0]!.props as object), effect: { kind: 'comment', targets: ['#84120'] } } }],
      }),
      { log },
    )
    expect(screen.regions.metrics.map(n => n.id)).toEqual(['metric:open-prs', 'metric:awaiting-review', 'metric:failing-checks'])
    expect(screen.regions.side).toEqual([])
    expect(screen.regions.action).toHaveLength(1)
    expect(records.filter(r => r.message === 'piece dropped by a composition rule').map(r => r.fields?.rule)).toEqual([
      'metrics holds at most 4',
      'action holds at most 1',
      'at most two metrics are hot',
      'two grows pieces never share a row',
    ])
  })
})
