import { describe, expect, it } from 'vitest'
import { FIXTURES } from './fixtures'
import { REGION_NAMES, toStream } from './format'
import { createStreamParser, emptyTree, toComposition } from './stream'

const composition = FIXTURES.releaseBlockers
const ids = (tree: ReturnType<typeof emptyTree>) => REGION_NAMES.flatMap(r => tree.regions[r].map(p => `${r}/${p.id}`))

describe('streaming parser', () => {
  it('builds the tree one message at a time, correct after each', () => {
    const ops = toStream(composition)
    const parser = createStreamParser()
    const expected: string[] = []
    for (const op of ops) {
      const tree = parser.push(`${JSON.stringify(op)}\n`)
      if (op.op === 'start') {
        expect(tree.id).toBe(composition.id)
        expect(tree.asks).toEqual(composition.asks)
      }
      if (op.op === 'add') expected.push(`${op.region}/${op.piece.id}`)
      expect(ids(tree)).toEqual(expected)
      expect(tree.done).toBe(op.op === 'done')
    }
    expect(toComposition(parser.tree())).toEqual(composition)
  })

  it('joins a line split across chunks, applies update and remove, and skips a malformed line', () => {
    const parser = createStreamParser()
    const text = toStream(composition).map(op => JSON.stringify(op)).join('\n')
    const cut = Math.floor(text.length / 2)
    parser.push(text.slice(0, cut))
    parser.push(text.slice(cut))
    let tree = parser.end()
    expect(toComposition(tree)).toEqual(composition)

    parser.push('{"op":"add","region":"nowhere"}\n{not json\n')
    expect(parser.tree()).toBe(tree)

    const bound = { ...(composition.regions.metrics[2]!.bound as object), value: 2 }
    tree = parser.push(`${JSON.stringify({ op: 'update', id: 'metric:failing-checks', props: bound })}\n`)
    expect(tree.regions.metrics[2]!.bound).toEqual(bound)
    expect(tree.regions.metrics[2]!.props).toEqual(composition.regions.metrics[2]!.props)

    tree = parser.push(`${JSON.stringify({ op: 'remove', id: 'metric:open-prs' })}\n`)
    expect(tree.regions.metrics.map(p => p.id)).not.toContain('metric:open-prs')

    tree = parser.push(`${JSON.stringify({ op: 'error', reason: 'Sonnet timed out' })}\n`)
    expect(tree).toMatchObject({ error: 'Sonnet timed out', done: true })
  })
})
