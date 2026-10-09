import { z } from 'zod'
import { MEASURE_IDS, MEASURES } from '@genui-github/data'
import type { ComponentState, HeightClass } from './types'

export interface OmittedState {
  state: Exclude<ComponentState, 'default'>
  reason: string
}

export interface ComponentSpec<S extends z.ZodType = z.ZodType> {
  name: string
  /** The model-facing props. System fields are not in it. */
  schema: S
  /** One line telling the model when to choose this component. */
  when: string
  heightClass?: HeightClass
  pickable: boolean
  statesOmitted?: OmittedState[]
  /** Builds the stable id. The key is the measure id, the list's kind and scope, or the rank's measure and window. */
  id?: { prefix?: string; key: (props: z.infer<S>) => string }
  /** One minimal valid props object, shown in the registry prompt. */
  example?: z.infer<S>
}

export interface PromptSection {
  title: string
  body: string
}

export interface Registry {
  register<S extends z.ZodType>(spec: ComponentSpec<S>): ComponentSpec<S>
  get(name: string): ComponentSpec | undefined
  all(): ComponentSpec[]
  heightClass(name: string): HeightClass | undefined
  deriveId(component: string, props: unknown): string
  toPrompt(options?: { preamble?: PromptSection[] }): string
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** Enums the prompt names once in its header; component schemas refer to them by name. */
export const SHARED_ENUMS: Record<string, readonly string[]> = {
  Measure: MEASURE_IDS,
  Tone: ['neutral', 'good', 'warn', 'crit'],
  EmptyTone: ['neutral', 'good'],
  Window: ['7d', '14d', '30d', '90d', '4w', '12w', '52w', 'week', 'month', 'milestone'],
}

const sameSet = (a: readonly unknown[], b: readonly string[]) => a.length === b.length && b.every(v => a.includes(v))

/**
 * The JSON Schema the model reads, minus what costs tokens and says nothing: `$schema`, `additionalProperties: false`
 * (the prompt says once that extra props are rejected), `minLength: 1`, a `type` an enum already implies, and shared
 * enums spelled out again, which become their name.
 */
function compact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(compact)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  const record = node as Record<string, unknown>
  const named = Array.isArray(record.enum) ? Object.entries(SHARED_ENUMS).find(([, values]) => sameSet(record.enum as unknown[], values))?.[0] : undefined
  if (named) return { ...(record.description ? { description: record.description } : {}), enum: named }
  for (const [key, value] of Object.entries(record)) {
    if (key === '$schema' || (key === 'additionalProperties' && value === false) || (key === 'minLength' && value === 1)) continue
    if (key === 'type' && Array.isArray(record.enum)) continue
    out[key] = compact(value)
  }
  return out
}

type Json = Record<string, unknown>

/** True when `text` has a `|` outside any braces or brackets, so it must be parenthesized as an array's items. */
function topLevelUnion(text: string): boolean {
  let depth = 0
  for (const ch of text) {
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth--
    else if (ch === '|' && depth === 0) return true
  }
  return false
}

const limits = (min: unknown, max: unknown) =>
  min !== undefined && max !== undefined ? `${min}-${max}` : max !== undefined ? `≤${max}` : min !== undefined ? `≥${min}` : ''

/**
 * A JSON Schema written as a TypeScript-like signature: the same names, optional marks, enums and limits in about
 * half the tokens. `string(≤28)` is a max length, `int(3-8)` a range, `[](1-4)` an array's item count.
 */
export function signature(node: unknown): string {
  if (!node || typeof node !== 'object') return 'unknown'
  const n = node as Json
  if (typeof n.enum === 'string') return n.enum
  if (Array.isArray(n.enum)) return n.enum.map(v => JSON.stringify(v)).join('|')
  if (n.const !== undefined) return JSON.stringify(n.const)
  for (const key of ['anyOf', 'oneOf'] as const) {
    if (Array.isArray(n[key])) return (n[key] as unknown[]).map(signature).join(' | ')
  }
  if (Array.isArray(n.allOf)) return (n.allOf as unknown[]).map(signature).join(' & ')
  switch (n.type) {
    case 'string': {
      const range = limits(n.minLength, n.maxLength)
      const format = typeof n.format === 'string' ? n.format : ''
      return `string${range || format ? `(${[format, range].filter(Boolean).join(' ')})` : ''}`
    }
    case 'integer':
    case 'number': {
      const range = limits(n.minimum ?? n.exclusiveMinimum, n.maximum)
      return `${n.type === 'integer' ? 'int' : 'number'}${range ? `(${range})` : ''}`
    }
    case 'boolean':
      return 'boolean'
    case 'array': {
      const item = signature(n.items)
      const items = Array.isArray(n.prefixItems)
        ? `[${(n.prefixItems as unknown[]).map(signature).join(', ')}]`
        : `${topLevelUnion(item) ? `(${item})` : item}[]`
      const range = limits(n.minItems, n.maxItems)
      return Array.isArray(n.prefixItems) ? items : `${items}${range ? `(${range})` : ''}`
    }
    case 'object': {
      const props = (n.properties ?? {}) as Record<string, unknown>
      const required = new Set((n.required as string[] | undefined) ?? [])
      const fields = Object.entries(props).map(([k, v]) => `${k}${required.has(k) ? '' : '?'}: ${signature(v)}`)
      if (!fields.length && n.additionalProperties && typeof n.additionalProperties === 'object')
        return `{[key: string]: ${signature(n.additionalProperties)}}`
      return `{${fields.join('; ')}}`
    }
    default:
      return 'unknown'
  }
}

function compactSchema(schema: z.ZodType): string {
  return signature(compact(z.toJSONSchema(schema, { unrepresentable: 'any' })))
}

function componentPrompt(spec: ComponentSpec): string {
  const lines = [spec.when, `Props: ${compactSchema(spec.schema)}`]
  if (spec.example !== undefined) lines.push(`Example: ${JSON.stringify(spec.example)}`)
  return lines.join('\n')
}

export function createRegistry(): Registry {
  const specs = new Map<string, ComponentSpec>()

  return {
    register(spec) {
      if (specs.has(spec.name)) throw new Error(`${spec.name} is already registered`)
      specs.set(spec.name, spec as unknown as ComponentSpec)
      return spec
    },
    get: name => specs.get(name),
    all: () => [...specs.values()],
    heightClass: name => specs.get(name)?.heightClass,
    deriveId(component, props) {
      const spec = specs.get(component)
      const prefix = spec?.id?.prefix ?? component.toLowerCase()
      if (spec?.id) {
        const parsed = spec.schema.safeParse(props)
        if (parsed.success) return `${prefix}:${spec.id.key(parsed.data)}`
      }
      // No data key: the props themselves identify the piece, so identical props survive a rewrite.
      return `${prefix}:${fnv1a(stableStringify(props))}`
    },
    toPrompt(options = {}) {
      const measures = MEASURE_IDS.map(id => {
        const m = MEASURES[id]
        return `${id} · ${m.unit} · better ${m.better} · ${m.what}`
      })
      const enums = Object.entries(SHARED_ENUMS)
        .filter(([name]) => name !== 'Measure')
        .map(([name, values]) => `${name}: ${values.join(' | ')}`)
      const sections: PromptSection[] = [
        ...(options.preamble ?? []),
        { title: 'Measures', body: `Measure is one of these ids; the system computes it.\n${measures.join('\n')}` },
        {
          title: 'How to read the props',
          body: `${enums.join('\n')}\nA field ending in ? is optional. string(≤28) caps the length; int(3-8) and [](1-4) give a range. Measure, Tone, EmptyTone and Window name the enums above. Props not listed are rejected.`,
        },
      ]
      for (const spec of specs.values()) {
        if (!spec.pickable) continue
        sections.push({ title: `${spec.name} · ${spec.heightClass ?? 'field'}`, body: componentPrompt(spec) })
      }
      return sections.map(s => `## ${s.title}\n${s.body}`).join('\n\n')
    },
  }
}
