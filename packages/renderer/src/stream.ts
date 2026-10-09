import { createLogger } from '@genui-github/core'
import { REGION_NAMES, emptyRegions, streamOpSchema, type WarnLog, type Ask, type Built, type Composition, type Density, type Piece, type Regions, type StreamOp } from './format'

/** The tree as the stream has built it so far. Each op returns a new tree; nothing is mutated. */
export interface StreamTree {
  id?: string
  density?: Density
  asks: Ask[]
  regions: Regions
  built?: Built
  error?: string
  done: boolean
}

export const emptyTree = (): StreamTree => ({ asks: [], regions: emptyRegions(), done: false })

const log = createLogger('renderer:stream')

export type ParsedLine = { ok: true; op: StreamOp } | { ok: false; reason: string }

/** Step 1 of the pipeline: one JSONL message. Malformed lines are reported, never thrown. */
export function parseLine(line: string): ParsedLine {
  let json: unknown
  try {
    json = JSON.parse(line)
  } catch (err) {
    return { ok: false, reason: `not JSON: ${(err as Error).message}` }
  }
  const parsed = streamOpSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, reason: `not a stream op: ${issue?.path.join('.') || 'op'} ${issue?.message ?? ''}`.trim() }
  }
  return { ok: true, op: parsed.data }
}

function locate(regions: Regions, id: string) {
  for (const region of REGION_NAMES) {
    const index = regions[region].findIndex(p => p.id === id)
    if (index >= 0) return { region, index }
  }
  return undefined
}

function withPiece(regions: Regions, region: keyof Regions, pieces: Piece[]): Regions {
  return { ...regions, [region]: pieces }
}

export function applyOp(tree: StreamTree, op: StreamOp, logger: WarnLog = log): StreamTree {
  switch (op.op) {
    case 'start':
      return { ...emptyTree(), id: op.id, density: op.density, asks: op.asks }
    case 'add': {
      const at = locate(tree.regions, op.piece.id)
      if (at && at.region === op.region) {
        const pieces = [...tree.regions[at.region]]
        pieces[at.index] = op.piece
        return { ...tree, regions: withPiece(tree.regions, at.region, pieces) }
      }
      // The same id in another region moves there: one piece, one place.
      const regions = at ? withPiece(tree.regions, at.region, tree.regions[at.region].filter(p => p.id !== op.piece.id)) : tree.regions
      return { ...tree, regions: withPiece(regions, op.region, [...regions[op.region], op.piece]) }
    }
    case 'update': {
      const at = locate(tree.regions, op.id)
      if (!at) {
        logger.warn('update for a piece not on screen', { id: op.id })
        return tree
      }
      const pieces = [...tree.regions[at.region]]
      pieces[at.index] = { ...pieces[at.index]!, bound: op.props }
      return { ...tree, regions: withPiece(tree.regions, at.region, pieces) }
    }
    case 'remove': {
      const at = locate(tree.regions, op.id)
      if (!at) return tree
      return { ...tree, regions: withPiece(tree.regions, at.region, tree.regions[at.region].filter(p => p.id !== op.id)) }
    }
    case 'done':
      return { ...tree, built: op.built, done: true }
    case 'error':
      return { ...tree, error: op.reason, done: true }
  }
}

/** A finished tree as a Composition, when it has everything one needs. */
export function toComposition(tree: StreamTree): Composition | undefined {
  if (!tree.id || !tree.density || !tree.built) return undefined
  return { id: tree.id, density: tree.density, regions: tree.regions, asks: tree.asks, built: tree.built }
}

export interface StreamParser {
  /** Feeds raw text; lines may arrive split across chunks. Returns the tree after every complete line. */
  push(chunk: string): StreamTree
  /** Flushes a last line that had no newline. */
  end(): StreamTree
  tree(): StreamTree
}

export function createStreamParser(options: { onTree?: (tree: StreamTree, op: StreamOp) => void; log?: WarnLog } = {}): StreamParser {
  const logger = options.log ?? log
  let tree = emptyTree()
  let buffer = ''

  const line = (text: string) => {
    if (!text.trim()) return
    const parsed = parseLine(text)
    if (!parsed.ok) {
      logger.warn('stream line skipped', { reason: parsed.reason })
      return
    }
    tree = applyOp(tree, parsed.op, logger)
    options.onTree?.(tree, parsed.op)
  }

  return {
    push(chunk) {
      buffer += chunk
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        line(buffer.slice(0, nl))
        buffer = buffer.slice(nl + 1)
        nl = buffer.indexOf('\n')
      }
      return tree
    },
    end() {
      line(buffer)
      buffer = ''
      return tree
    },
    tree: () => tree,
  }
}
