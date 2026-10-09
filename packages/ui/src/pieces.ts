import type { ComponentType } from 'react'
import type { PieceMotion } from './motion/types'
import type { PieceRenderProps } from './types'
import { ActionCard } from './components/ActionCard/ActionCard'
import { actionCardMotion } from './components/ActionCard/motion'
import { ActivityFeed } from './components/ActivityFeed/ActivityFeed'
import { activityFeedMotion } from './components/ActivityFeed/motion'
import { BarChart } from './components/BarChart/BarChart'
import { barChartMotion } from './components/BarChart/motion'
import { Callout } from './components/Callout/Callout'
import { calloutMotion } from './components/Callout/motion'
import { Checklist } from './components/Checklist/Checklist'
import { checklistMotion } from './components/Checklist/motion'
import { CodeBlock } from './components/CodeBlock/CodeBlock'
import { codeBlockMotion } from './components/CodeBlock/motion'
import { Comparison } from './components/Comparison/Comparison'
import { comparisonMotion } from './components/Comparison/motion'
import { ContributorRank } from './components/ContributorRank/ContributorRank'
import { contributorRankMotion } from './components/ContributorRank/motion'
import { DiffView } from './components/DiffView/DiffView'
import { diffViewMotion } from './components/DiffView/motion'
import { Distribution } from './components/Distribution/Distribution'
import { distributionMotion } from './components/Distribution/motion'
import { EmptyState } from './components/EmptyState/EmptyState'
import { emptyStateMotion } from './components/EmptyState/motion'
import { FileTree } from './components/FileTree/FileTree'
import { fileTreeMotion } from './components/FileTree/motion'
import { FilterChips } from './components/FilterChips/FilterChips'
import { filterChipsMotion } from './components/FilterChips/motion'
import { Form } from './components/Form/Form'
import { formMotion } from './components/Form/motion'
import { Heatmap } from './components/Heatmap/Heatmap'
import { heatmapMotion } from './components/Heatmap/motion'
import { Insight } from './components/Insight/Insight'
import { insightMotion } from './components/Insight/motion'
import { KeyValue } from './components/KeyValue/KeyValue'
import { keyValueMotion } from './components/KeyValue/motion'
import { LineChart } from './components/LineChart/LineChart'
import { lineChartMotion } from './components/LineChart/motion'
import { Metric } from './components/Metric/Metric'
import { metricMotion } from './components/Metric/motion'
import { PersonList } from './components/PersonList/PersonList'
import { personListMotion } from './components/PersonList/motion'
import { Progress } from './components/Progress/Progress'
import { progressMotion } from './components/Progress/motion'
import { Select } from './components/Select/Select'
import { selectMotion } from './components/Select/motion'
import { StatusList } from './components/StatusList/StatusList'
import { statusListMotion } from './components/StatusList/motion'
import { Steps } from './components/Steps/Steps'
import { stepsMotion } from './components/Steps/motion'
import { TextInput } from './components/TextInput/TextInput'
import { textInputMotion } from './components/TextInput/motion'
import { Timeline } from './components/Timeline/Timeline'
import { timelineMotion } from './components/Timeline/motion'
import { WarmingUp } from './components/WarmingUp/WarmingUp'
import { warmingUpMotion } from './components/WarmingUp/motion'

/** What the renderer needs to put a registered component on screen: the component and its choreography. */
export interface PieceDefinition<P = unknown> {
  Component: ComponentType<PieceRenderProps<P>>
  motion: PieceMotion<P>
}

const piece = <P,>(Component: ComponentType<PieceRenderProps<P>>, motion: PieceMotion<P>) => ({ Component, motion }) as unknown as PieceDefinition

/** Every component a composition may hold, pickable or placed by the system. Layout primitives are not pieces. */
export const PIECES: Readonly<Record<string, PieceDefinition>> = {
  ActionCard: piece(ActionCard, actionCardMotion),
  ActivityFeed: piece(ActivityFeed, activityFeedMotion),
  BarChart: piece(BarChart, barChartMotion),
  Callout: piece(Callout, calloutMotion),
  Checklist: piece(Checklist, checklistMotion),
  CodeBlock: piece(CodeBlock, codeBlockMotion),
  Comparison: piece(Comparison, comparisonMotion),
  ContributorRank: piece(ContributorRank, contributorRankMotion),
  DiffView: piece(DiffView, diffViewMotion),
  Distribution: piece(Distribution, distributionMotion),
  EmptyState: piece(EmptyState, emptyStateMotion),
  FileTree: piece(FileTree, fileTreeMotion),
  FilterChips: piece(FilterChips, filterChipsMotion),
  Form: piece(Form, formMotion),
  Heatmap: piece(Heatmap, heatmapMotion),
  Insight: piece(Insight, insightMotion),
  KeyValue: piece(KeyValue, keyValueMotion),
  LineChart: piece(LineChart, lineChartMotion),
  Metric: piece(Metric, metricMotion),
  PersonList: piece(PersonList, personListMotion),
  Progress: piece(Progress, progressMotion),
  Select: piece(Select, selectMotion),
  StatusList: piece(StatusList, statusListMotion),
  Steps: piece(Steps, stepsMotion),
  TextInput: piece(TextInput, textInputMotion),
  Timeline: piece(Timeline, timelineMotion),
  WarmingUp: piece(WarmingUp, warmingUpMotion),
}
