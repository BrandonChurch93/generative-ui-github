import type { ComponentType } from 'react'
import { ActionCard } from '../components/ActionCard/ActionCard'
import { actionCardMotion } from '../components/ActionCard/motion'
import actionCardSample from '../components/ActionCard/sample.json'
import type { ActionCardProps } from '../components/ActionCard/schema'
import { Insight } from '../components/Insight/Insight'
import { insightMotion } from '../components/Insight/motion'
import insightSample from '../components/Insight/sample.json'
import type { InsightProps } from '../components/Insight/schema'
import { LineChart } from '../components/LineChart/LineChart'
import { lineChartMotion } from '../components/LineChart/motion'
import lineChartSample from '../components/LineChart/sample.json'
import type { LineChartProps } from '../components/LineChart/schema'
import { Metric } from '../components/Metric/Metric'
import { metricMotion } from '../components/Metric/motion'
import metricSample from '../components/Metric/sample.json'
import type { MetricProps } from '../components/Metric/schema'
import { statusListMotion } from '../components/StatusList/motion'
import statusListSample from '../components/StatusList/sample.json'
import type { StatusListProps } from '../components/StatusList/schema'
import { StatusList } from '../components/StatusList/StatusList'
import { timelineMotion } from '../components/Timeline/motion'
import timelineSample from '../components/Timeline/sample.json'
import type { TimelineProps } from '../components/Timeline/schema'
import { Timeline } from '../components/Timeline/Timeline'
import { sparklineMotion } from '../components/Sparkline/motion'
import sparklineSample from '../components/Sparkline/sample.json'
import { SparklineDemo } from '../components/Sparkline/SparklineDemo'
import { ContributorRank } from '../components/ContributorRank/ContributorRank'
import { contributorRankMotion } from '../components/ContributorRank/motion'
import contributorRankSample from '../components/ContributorRank/sample.json'
import type { ContributorRankProps } from '../components/ContributorRank/schema'
import { Comparison } from '../components/Comparison/Comparison'
import { comparisonMotion } from '../components/Comparison/motion'
import comparisonSample from '../components/Comparison/sample.json'
import type { ComparisonProps } from '../components/Comparison/schema'
import { Distribution } from '../components/Distribution/Distribution'
import { distributionMotion } from '../components/Distribution/motion'
import distributionSample from '../components/Distribution/sample.json'
import type { DistributionProps } from '../components/Distribution/schema'
import { Heatmap } from '../components/Heatmap/Heatmap'
import { heatmapMotion } from '../components/Heatmap/motion'
import heatmapSample from '../components/Heatmap/sample.json'
import type { HeatmapProps } from '../components/Heatmap/schema'
import { Steps } from '../components/Steps/Steps'
import { stepsMotion } from '../components/Steps/motion'
import stepsSample from '../components/Steps/sample.json'
import type { StepsProps } from '../components/Steps/schema'
import { WarmingUp } from '../components/WarmingUp/WarmingUp'
import { warmingUpMotion } from '../components/WarmingUp/motion'
import warmingUpSample from '../components/WarmingUp/sample.json'
import type { WarmingUpProps } from '../components/WarmingUp/schema'
import { FileTree } from '../components/FileTree/FileTree'
import { fileTreeMotion } from '../components/FileTree/motion'
import fileTreeSample from '../components/FileTree/sample.json'
import type { FileTreeProps } from '../components/FileTree/schema'
import { DiffView } from '../components/DiffView/DiffView'
import { diffViewMotion } from '../components/DiffView/motion'
import diffViewSample from '../components/DiffView/sample.json'
import type { DiffViewProps } from '../components/DiffView/schema'
import * as layout from './layoutDemos'
import type { PieceMotion } from '../motion/types'
import type { ComponentSpec } from '../registry'
import { registry } from '../specs'
import type { ErrorInfo, PieceRenderProps, WarmingInfo } from '../types'

export const CATALOG_GROUPS = ['Data', 'Text', 'Actions', 'Inputs', 'Paths', 'Code', 'System', 'Primitives'] as const
export type CatalogGroup = (typeof CATALOG_GROUPS)[number]

/** What a component's sample.json holds: the default props, and whatever each other state needs. */
export interface CatalogSample<P> {
  props: P
  /** Other default-state versions worth seeing, such as two series or a failure strip. */
  variants?: { label: string; props: P }[]
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
  width?: 'quarter' | 'third' | 'half' | 'full'
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
  entry<TimelineProps>({
    name: 'Timeline',
    group: 'Data',
    description:
      'Merged pull requests as events in time, newest first and grouped by day, joined by a 1px spine so the card reads as time rather than as a list of states.',
    spec: specOf('Timeline'),
    Component: Timeline,
    motion: timelineMotion,
    sample: timelineSample as CatalogSample<TimelineProps>,
    sampleFile: 'Timeline/sample.json',
    width: 'half',
  }),
  entry<LineChartProps>({
    name: 'LineChart',
    group: 'Data',
    description:
      'A trend over weeks: one or two lines on one zero-based y axis with the latest value at each line end and, when failures matter, a strip of failed runs under the plot that shares its weeks.',
    spec: specOf('LineChart'),
    Component: LineChart,
    motion: lineChartMotion,
    sample: lineChartSample as CatalogSample<LineChartProps>,
    sampleFile: 'LineChart/sample.json',
    width: 'half',
  }),
  entry<InsightProps>({
    name: 'Insight',
    group: 'Text',
    description:
      'The one sentence the model writes about the data, with a gradient rule on its left and a source line naming what it was computed from.',
    spec: specOf('Insight'),
    Component: Insight,
    motion: insightMotion,
    sample: insightSample as CatalogSample<InsightProps>,
    sampleFile: 'Insight/sample.json',
    width: 'full',
  }),
  entry<ActionCardProps>({
    name: 'ActionCard',
    group: 'Actions',
    description:
      'One thing the model proposes doing next, stated as its effect, with an inline second step that restates exactly what will happen. Sample mode only: it drafts and shows, never writes to GitHub.',
    spec: specOf('ActionCard'),
    Component: ActionCard,
    motion: actionCardMotion,
    sample: actionCardSample as CatalogSample<ActionCardProps>,
    sampleFile: 'ActionCard/sample.json',
    width: 'third',
  }),
  entry<ContributorRankProps>({
    name: 'ContributorRank',
    group: 'Data',
    description: "Who carries a repo's work: one ranked share bar per person, with the smallest group that carries half the work, the bus factor, set apart as the load-bearing wall.",
    spec: specOf('ContributorRank'),
    Component: ContributorRank,
    motion: contributorRankMotion,
    sample: contributorRankSample as CatalogSample<ContributorRankProps>,
    sampleFile: 'ContributorRank/sample.json',
    width: 'half',
  }),
  entry<ComparisonProps>({
    name: 'Comparison',
    group: 'Data',
    description: 'Two periods side by side for two to four measures, each a pair of bars on its own zero-based scale with a signed delta and a verdict in a fixed column on the right.',
    spec: specOf('Comparison'),
    Component: Comparison,
    motion: comparisonMotion,
    sample: comparisonSample as CatalogSample<ComparisonProps>,
    sampleFile: 'Comparison/sample.json',
    width: 'half',
  }),
  entry<DistributionProps>({
    name: 'Distribution',
    group: 'Data',
    description: 'A histogram of how long something takes, with one ink marker that answers how long would I wait in words and a quieter p90 rule for the tail.',
    spec: specOf('Distribution'),
    Component: Distribution,
    motion: distributionMotion,
    sample: distributionSample as CatalogSample<DistributionProps>,
    sampleFile: 'Distribution/sample.json',
    width: 'half',
  }),
  entry<HeatmapProps>({
    name: 'Heatmap',
    group: 'Data',
    description: "A punch card of when work happens: seven weekday rows by 24 hour columns in the viewer's time zone, each cell's count drawn as a step on one coral heat ramp.",
    spec: specOf('Heatmap'),
    Component: Heatmap,
    motion: heatmapMotion,
    sample: heatmapSample as CatalogSample<HeatmapProps>,
    sampleFile: 'Heatmap/sample.json',
    width: 'half',
  }),
  entry<StepsProps>({
    name: 'Steps',
    group: 'Paths',
    description: "An ordered path the model writes from the repo's own data, drawn as numbered rings on a hairline spine. Each step is an action title with a line or two of body, an optional fact and an optional link.",
    spec: specOf('Steps'),
    Component: Steps,
    motion: stepsMotion,
    sample: stepsSample as CatalogSample<StepsProps>,
    sampleFile: 'Steps/sample.json',
    width: 'half',
  }),
  entry<WarmingUpProps>({
    name: 'WarmingUp',
    group: 'System',
    description: "What the composition region shows while GitHub computes a repo's statistics for the first time: one calm sentence, then a lane per statistic where a line runs in real time until that count lands.",
    spec: specOf('WarmingUp'),
    Component: WarmingUp,
    motion: warmingUpMotion,
    sample: warmingUpSample as CatalogSample<WarmingUpProps>,
    sampleFile: 'WarmingUp/sample.json',
    width: 'full',
  }),
  entry<FileTreeProps>({
    name: 'FileTree',
    group: 'Code',
    description: 'The files a pull request touches, or the layout of a folder, as an indented tree with quiet guides, per-file counts in one right-aligned column and one selected file.',
    spec: specOf('FileTree'),
    Component: FileTree,
    motion: fileTreeMotion,
    sample: fileTreeSample as CatalogSample<FileTreeProps>,
    sampleFile: 'FileTree/sample.json',
    width: 'third',
  }),
  entry<DiffViewProps>({
    name: 'DiffView',
    group: 'Code',
    description: 'A unified diff for one file of a pull request, with ink text on quiet add and delete tints, a sign gutter that carries direction without color, and a calm fold when the file runs long.',
    spec: specOf('DiffView'),
    Component: DiffView,
    motion: diffViewMotion,
    sample: diffViewSample as CatalogSample<DiffViewProps>,
    sampleFile: 'DiffView/sample.json',
    width: 'half',
  }),
  entry({
    name: 'Surface',
    group: 'Primitives',
    description: 'A plain card ground for pieces that bring their own insides.',
    spec: specOf('Surface'),
    Component: layout.SurfaceDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Section',
    group: 'Primitives',
    description: 'A titled group of pieces.',
    spec: specOf('Section'),
    Component: layout.SectionDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Stack',
    group: 'Primitives',
    description: 'Pieces one above the other at the density gap.',
    spec: specOf('Stack'),
    Component: layout.StackDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Grid',
    group: 'Primitives',
    description: 'Pieces in equal columns that collapse on narrow screens.',
    spec: specOf('Grid'),
    Component: layout.GridDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'full',
  }),
  entry({
    name: 'SplitView',
    group: 'Primitives',
    description: 'The main and side columns of a composed screen.',
    spec: specOf('SplitView'),
    Component: layout.SplitViewDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'full',
  }),
  entry({
    name: 'Drawer',
    group: 'Primitives',
    description: 'A sheet from the right edge over a scrim; Escape closes it and focus returns.',
    spec: specOf('Drawer'),
    Component: layout.DrawerDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Tabs',
    group: 'Primitives',
    description: 'Panels behind a row of tabs; arrow keys move between them.',
    spec: specOf('Tabs'),
    Component: layout.TabsDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Heading',
    group: 'Primitives',
    description: "The question, a section title or a card title in the system's type styles.",
    spec: specOf('Heading'),
    Component: layout.HeadingDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Text',
    group: 'Primitives',
    description: 'Lead, body, hint or meta text.',
    spec: specOf('Text'),
    Component: layout.TextDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'List',
    group: 'Primitives',
    description: "A plain list in the system's row rhythm.",
    spec: specOf('List'),
    Component: layout.ListDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Avatar',
    group: 'Primitives',
    description: 'A person as initials from their handle.',
    spec: specOf('Avatar'),
    Component: layout.AvatarDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Button',
    group: 'Primitives',
    description: 'Primary is the accent gradient; secondary is surface with a line border. Hover lifts 1px.',
    spec: specOf('Button'),
    Component: layout.ButtonDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'half',
  }),
  entry({
    name: 'Ask',
    group: 'Primitives',
    description: 'A suggested question chip; the selected one is tinted, the rest muted until hover.',
    spec: specOf('Ask'),
    Component: layout.AskDemo,
    sample: { props: {} },
    sampleFile: 'none · layout has no data',
    width: 'full',
  }),
]

export function catalogEntry(name: string): CatalogEntry | undefined {
  return CATALOG.find(e => e.name === name)
}
