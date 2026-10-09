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

/** The JSON Schema the model reads, minus the noise that costs tokens and says nothing. */
function compactSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>
  delete json.$schema
  return json
}

function componentPrompt(spec: ComponentSpec): string {
  const lines = [spec.when, `Props: ${JSON.stringify(compactSchema(spec.schema))}`]
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
      const sections: PromptSection[] = [
        ...(options.preamble ?? []),
        { title: 'Measures', body: `Name a measure by id; the system computes it.\n${measures.join('\n')}` },
      ]
      for (const spec of specs.values()) {
        if (!spec.pickable) continue
        sections.push({ title: `${spec.name} · ${spec.heightClass ?? 'field'}`, body: componentPrompt(spec) })
      }
      return sections.map(s => `## ${s.title}\n${s.body}`).join('\n\n')
    },
  }
}

/** The one registry the renderer, the composer and the catalog share. */
export const registry = createRegistry()
