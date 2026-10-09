import { buildContext, closure, memoryCache, type ContextNeeds, type DataContext } from '@genui-github/data/server'
import { CONTEXT_NOW, CONTEXT_ZONE, fixtureClient, NEXT } from '@genui-github/data/testing'
import { MEASURE_IDS, SHAPE_NAMES } from '@genui-github/data'
import { validatePiece, type Piece, type RegionName } from '@genui-github/renderer/core'
import { createLogger, type LogRecord } from '@genui-github/core'

// Test helpers for binders: the recorded next.js context, and a check that a piece passes the renderer's pipeline.

const EVERYTHING: ContextNeeds = { shapes: SHAPE_NAMES.filter(s => s !== 'tree'), measures: MEASURE_IDS }
let shared: Promise<DataContext> | undefined

/** Every shape and measure for vercel/next.js, replayed from the recorded fixture. Built once per test file. */
export function nextContext(): Promise<DataContext> {
  shared ??= buildContext(fixtureClient('context-nextjs').client, memoryCache({ now: () => CONTEXT_NOW }), NEXT, EVERYTHING, { now: CONTEXT_NOW, timeZone: CONTEXT_ZONE })
  return shared
}

export { CONTEXT_NOW, CONTEXT_ZONE, closure }

/** The renderer's validation of one piece, with whatever it logged. A good piece logs nothing. */
export function check(piece: Piece, region: RegionName = 'main') {
  const records: LogRecord[] = []
  const node = validatePiece(piece, region, { log: createLogger('test', { level: 'debug', sink: r => records.push(r) }), final: true })
  return { node, warnings: records.map(r => `${r.message} ${JSON.stringify(r.fields)}`) }
}
