import { compositionSchema, REGION_NAMES, type Composition, type Piece, type RegionName } from './format'

// A2UI v0.9 (a2ui.org/specification/v0.9-a2ui). v0.9.1 accepts these payloads unchanged.
// The internal format is the source of truth; this is an export of it and the import back.

export const A2UI_VERSION = 'v0.9'
/** Our custom catalog: the basic Column and Row plus the components in packages/ui. Not resolvable, as the spec allows. */
export const A2UI_CATALOG_ID = 'urn:genui-github:catalog:v1'
export const A2UI_ROOT_ID = 'root'

export type A2UIChildList = string[] | { path: string; componentId: string }

/** One entry in the adjacency list. Type-specific properties sit beside `id` and `component`. */
export interface A2UIComponent {
  id: string
  component: string
  children?: A2UIChildList
  child?: string
  [prop: string]: unknown
}

export interface A2UITheme {
  density: Composition['density']
}

/** The data model holds the composition fields that are not pieces. */
export interface A2UIDataModel {
  asks: Composition['asks']
  built: Composition['built']
}

export type A2UIMessage =
  | {
      version: typeof A2UI_VERSION
      createSurface: { surfaceId: string; catalogId: string; theme?: A2UITheme; sendDataModel?: boolean }
    }
  | { version: typeof A2UI_VERSION; updateComponents: { surfaceId: string; components: A2UIComponent[] } }
  | { version: typeof A2UI_VERSION; updateDataModel: { surfaceId: string; path?: string; value?: unknown } }
  | { version: typeof A2UI_VERSION; deleteSurface: { surfaceId: string } }

const PIECE_FIELDS = ['props', 'ask', 'emphasis', 'tone', 'bound', 'state', 'error', 'warming', 'cites'] as const

const REGION_CONTAINER: Record<RegionName, 'Column' | 'Row'> = {
  insight: 'Column',
  metrics: 'Row',
  main: 'Column',
  side: 'Column',
  action: 'Column',
}

export const regionComponentId = (region: RegionName): string => `region:${region}`

const RESERVED_IDS = new Set<string>([A2UI_ROOT_ID, ...REGION_NAMES.map(regionComponentId)])

function pieceComponent(piece: Piece): A2UIComponent {
  const entry: A2UIComponent = { id: piece.id, component: piece.component }
  for (const field of PIECE_FIELDS) {
    if (piece[field] !== undefined) entry[field] = piece[field]
  }
  return entry
}

export function toA2UI(composition: Composition): A2UIMessage[] {
  const surfaceId = composition.id
  const components: A2UIComponent[] = [
    { id: A2UI_ROOT_ID, component: 'Column', children: REGION_NAMES.map(regionComponentId) },
  ]
  for (const region of REGION_NAMES) {
    const pieces = composition.regions[region]
    components.push({
      id: regionComponentId(region),
      component: REGION_CONTAINER[region],
      children: pieces.map(piece => piece.id),
    })
    for (const piece of pieces) {
      if (RESERVED_IDS.has(piece.id)) throw new Error(`Piece id "${piece.id}" is reserved by the A2UI surface layout`)
      components.push(pieceComponent(piece))
    }
  }
  const dataModel: A2UIDataModel = { asks: composition.asks, built: composition.built }
  return [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId, catalogId: A2UI_CATALOG_ID, theme: { density: composition.density } },
    },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components } },
    { version: A2UI_VERSION, updateDataModel: { surfaceId, value: dataModel } },
  ]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** RFC 6901 set on a plain object tree; an absent value removes the key, as the spec says. */
function setPointer(model: Record<string, unknown>, path: string | undefined, value: unknown): Record<string, unknown> {
  if (path === undefined || path === '' || path === '/') return isRecord(value) ? value : {}
  const keys = path
    .split('/')
    .slice(1)
    .map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'))
  const last = keys.pop()
  if (last === undefined) return model
  let node: Record<string, unknown> = model
  for (const key of keys) {
    const next = node[key]
    if (!isRecord(next)) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  if (value === undefined) delete node[last]
  else node[last] = value
  return model
}

/**
 * Rebuilds the composition from the first surface the messages create. Messages it cannot read are
 * skipped; it throws only when what is left is not a valid Composition.
 */
export function fromA2UI(messages: readonly A2UIMessage[]): Composition {
  let surfaceId: string | undefined
  let theme: Record<string, unknown> = {}
  let components = new Map<string, A2UIComponent>()
  let dataModel: Record<string, unknown> = {}

  for (const message of messages as readonly unknown[]) {
    if (!isRecord(message)) continue
    const create = message.createSurface
    if (isRecord(create) && typeof create.surfaceId === 'string') {
      if (surfaceId === undefined) surfaceId = create.surfaceId
      if (create.surfaceId === surfaceId) {
        theme = isRecord(create.theme) ? create.theme : {}
        components = new Map()
        dataModel = {}
      }
      continue
    }
    const update = message.updateComponents
    if (isRecord(update) && update.surfaceId === surfaceId && Array.isArray(update.components)) {
      for (const entry of update.components as unknown[]) {
        if (isRecord(entry) && typeof entry.id === 'string' && typeof entry.component === 'string') {
          components.set(entry.id, entry as A2UIComponent)
        }
      }
      continue
    }
    const data = message.updateDataModel
    if (isRecord(data) && data.surfaceId === surfaceId) {
      dataModel = setPointer(dataModel, typeof data.path === 'string' ? data.path : undefined, data.value)
      continue
    }
    const del = message.deleteSurface
    if (isRecord(del) && del.surfaceId === surfaceId) {
      theme = {}
      components = new Map()
      dataModel = {}
    }
  }

  const childIds = (id: string): string[] => {
    const children = components.get(id)?.children
    return Array.isArray(children) ? children.filter((c): c is string => typeof c === 'string') : []
  }
  const rootChildren = new Set(childIds(A2UI_ROOT_ID))

  const regions = Object.fromEntries(
    REGION_NAMES.map(region => {
      const containerId = regionComponentId(region)
      const ids = rootChildren.has(containerId) ? childIds(containerId) : []
      const pieces = ids.flatMap(id => {
        const entry = components.get(id)
        if (entry === undefined) return []
        const piece: Record<string, unknown> = { id: entry.id, component: entry.component }
        for (const field of PIECE_FIELDS) {
          if (Object.hasOwn(entry, field)) piece[field] = entry[field]
        }
        return [piece]
      })
      return [region, pieces]
    }),
  )

  const result = compositionSchema.safeParse({
    id: surfaceId,
    density: theme.density,
    regions,
    asks: dataModel.asks,
    built: dataModel.built,
  })
  if (!result.success) {
    const where = result.error.issues.map(issue => issue.path.join('.') || '(root)').join(', ')
    throw new Error(`A2UI messages do not rebuild a valid composition · invalid at ${where}`)
  }
  return result.data
}
