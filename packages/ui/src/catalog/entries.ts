import type { ComponentType } from 'react'
import { Probe } from '../components/Probe/Probe'
import probeSample from '../components/Probe/sample.json'
import type { ComponentSpec } from '../registry'
import { registry } from '../specs'
import type { ErrorInfo, PieceRenderProps, WarmingInfo } from '../types'

export const CATALOG_GROUPS = ['Data', 'Text', 'Actions', 'Inputs', 'Paths', 'Code', 'System', 'Primitives', 'Scaffolding'] as const
export type CatalogGroup = (typeof CATALOG_GROUPS)[number]

/** What a component's sample.json holds: the default props, and whatever each other state needs. */
export interface CatalogSample<P> {
  props: P
  empty?: P
  error?: ErrorInfo
  warming?: WarmingInfo
}

export interface CatalogEntry<P = unknown> {
  name: string
  group: CatalogGroup
  /** One or two sentences from the README: what it is and what it shows. */
  description: string
  spec: ComponentSpec
  Component: ComponentType<PieceRenderProps<P>>
  sample: CatalogSample<P>
  sampleFile: string
}

function entry<P>(e: CatalogEntry<P>): CatalogEntry {
  return e as unknown as CatalogEntry
}

function specOf(name: string): ComponentSpec {
  const spec = registry.get(name)
  if (!spec) throw new Error(`${name} is in the catalog but not in the registry`)
  return spec
}

export const CATALOG: CatalogEntry[] = [
  entry({
    name: 'Probe',
    group: 'Scaffolding',
    description: 'A placeholder that proves the catalog renders a registered spec in every state and density. Metric replaces it.',
    spec: specOf('Probe'),
    Component: Probe,
    sample: probeSample,
    sampleFile: 'Probe/sample.json',
  }),
]

export function catalogEntry(name: string): CatalogEntry | undefined {
  return CATALOG.find(e => e.name === name)
}
