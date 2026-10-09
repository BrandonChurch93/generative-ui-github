import { REGION_NAMES, type RegionName } from './format'
import type { RenderNode, Screen } from './validate'

export interface DiffEntry {
  id: string
  region: RegionName
  /** Position in its region: the old one for exits, the new one otherwise. */
  index: number
  node: RenderNode
  /** Survivors only: what was on screen before. */
  prev?: RenderNode
}

export interface Diff {
  /**
   * `rewrite`: a new composition replaced the old one. `update`: live data changed under the same
   * composition, so survivors run their update instead of their morph.
   */
  mode: 'initial' | 'rewrite' | 'update'
  exit: DiffEntry[]
  enter: DiffEntry[]
  morph: DiffEntry[]
  keep: DiffEntry[]
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object).filter(k => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b as object).filter(k => (b as Record<string, unknown>)[k] !== undefined)
  if (ka.length !== kb.length) return false
  return ka.every(k => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** What a reader would see change: props, state, the system's words for it, and the model's emphasis and tone. */
export function sameNode(a: RenderNode, b: RenderNode): boolean {
  return (
    a.component === b.component &&
    a.state === b.state &&
    a.emphasis === b.emphasis &&
    a.tone === b.tone &&
    a.ask === b.ask &&
    equal(a.props, b.props) &&
    equal(a.error, b.error) &&
    equal(a.warming, b.warming)
  )
}

function entries(screen: Screen | undefined): Map<string, DiffEntry> {
  const map = new Map<string, DiffEntry>()
  if (!screen) return map
  for (const region of REGION_NAMES) screen.regions[region].forEach((node, index) => map.set(node.id, { id: node.id, region, index, node }))
  return map
}

const order = (a: DiffEntry, b: DiffEntry) => REGION_NAMES.indexOf(a.region) - REGION_NAMES.indexOf(b.region) || a.index - b.index

/** Current tree and next tree to exit, enter, morph and keep, by stable id, each list in reading order. */
export function diff(prev: Screen | undefined, next: Screen): Diff {
  const before = entries(prev)
  const after = entries(next)
  const mode: Diff['mode'] = !prev ? 'initial' : prev.id === next.id ? 'update' : 'rewrite'
  const result: Diff = { mode, exit: [], enter: [], morph: [], keep: [] }

  for (const [id, entry] of after) {
    const old = before.get(id)
    // A piece that changed component under the same id cannot morph; it leaves and the new one arrives.
    if (!old || old.node.component !== entry.node.component) {
      result.enter.push(entry)
      if (old) result.exit.push(old)
    } else if (sameNode(old.node, entry.node) && old.region === entry.region) {
      result.keep.push({ ...entry, prev: old.node })
    } else {
      result.morph.push({ ...entry, prev: old.node })
    }
  }
  for (const [id, entry] of before) if (!after.has(id)) result.exit.push(entry)

  for (const list of [result.exit, result.enter, result.morph, result.keep]) list.sort(order)
  return result
}
