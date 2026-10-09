import type { Composition } from './format'
import type { StreamTree } from './stream'
import { validateRegions, type Screen, type ValidateOptions } from './validate'

/** A composition, or the tree a stream has built so far, validated and ready to render. */
export function toScreen(source: Composition | StreamTree, options: ValidateOptions = {}): Screen {
  const tree = 'done' in source ? source : undefined
  const final = tree ? tree.done : true
  return {
    id: source.id ?? 'pending',
    density: source.density ?? 'comfortable',
    asks: source.asks,
    regions: validateRegions(source.regions, { free: source.built?.template === 'off-template', ...options, final }),
    built: source.built,
    error: tree?.error,
    final,
  }
}
