import type { ComponentType } from 'react'
import { Metric } from '../components/Metric/Metric'
import { metricMotion } from '../components/Metric/motion'
import metricSample from '../components/Metric/sample.json'
import type { MetricProps } from '../components/Metric/schema'
import { statusListMotion } from '../components/StatusList/motion'
import statusListSample from '../components/StatusList/sample.json'
import type { StatusListProps } from '../components/StatusList/schema'
import { StatusList } from '../components/StatusList/StatusList'
import { sparklineMotion } from '../components/Sparkline/motion'
import sparklineSample from '../components/Sparkline/sample.json'
import { SparklineDemo } from '../components/Sparkline/SparklineDemo'
import type { PieceMotion } from '../motion/types'
import type { ComponentSpec } from '../registry'
import { registry } from '../specs'
import type { ErrorInfo, PieceRenderProps, WarmingInfo } from '../types'

export const CATALOG_GROUPS = ['Data', 'Text', 'Actions', 'Inputs', 'Paths', 'Code', 'System', 'Primitives'] as const
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
  /** Registered components have a spec. Parts (Sparkline) are shown but never picked. */
  spec?: ComponentSpec
  Component: ComponentType<PieceRenderProps<P>>
  motion?: PieceMotion<P>
  sample: CatalogSample<P>
  sampleFile: string
  /** How wide the piece sits on the catalog stage. */
  width?: 'quarter' | 'half' | 'full'
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
  entry<MetricProps>({
    name: 'Metric',
    group: 'Data',
    description:
      'One number that answers part of the question, with its label above, its delta below and an accent bar that extends along the bottom edge on arrival.',
    spec: specOf('Metric'),
    Component: Metric,
    motion: metricMotion,
    sample: metricSample as CatalogSample<MetricProps>,
    sampleFile: 'Metric/sample.json',
    width: 'quarter',
  }),
  entry({
    name: 'Sparkline',
    group: 'Data',
    description:
      'The inline trend beside a number: 12 weeks as a 2px line with the latest week and its endpoint in accent, no axes. A part of Metric and list rows, never picked on its own.',
    Component: SparklineDemo,
    motion: sparklineMotion,
    sample: sparklineSample,
    sampleFile: 'Sparkline/sample.json',
    width: 'quarter',
  }),
  entry<StatusListProps>({
    name: 'StatusList',
    group: 'Data',
    description:
      'A titled list of items, each carrying a state the model picked, in the mark, title, meta, size and tag rhythm every list in the system shares.',
    spec: specOf('StatusList'),
    Component: StatusList,
    motion: statusListMotion,
    sample: statusListSample as CatalogSample<StatusListProps>,
    sampleFile: 'StatusList/sample.json',
    width: 'half',
  }),
]

export function catalogEntry(name: string): CatalogEntry | undefined {
  return CATALOG.find(e => e.name === name)
}
