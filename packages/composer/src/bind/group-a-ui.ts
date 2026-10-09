import { ActivityFeed, Callout, Checklist, KeyValue, PersonList, Progress } from '@genui-github/ui/schemas'
import type { ActionCard, Insight, Metric, StatusList } from '@genui-github/ui/schemas'

// The ui types and words group A's binders read, by the short names the binders use. Everything here comes
// from `@genui-github/ui/schemas`; nothing is copied.

export { WINDOW_WORDS, type Window } from '@genui-github/ui/schemas'

export type InsightModelProps = Insight.InsightModelProps
export type InsightProps = Insight.InsightProps
export type InsightSource = Insight.InsightSource

export type MetricModelProps = Metric.MetricModelProps
export type MetricProps = Metric.MetricProps

export type StatusKind = StatusList.StatusKind
export type StatusScope = StatusList.StatusScope
export type StatusListModelProps = StatusList.StatusListModelProps
export type StatusSort = NonNullable<StatusListModelProps['sort']>
export type StatusItem<K extends StatusKind = StatusKind> = StatusList.StatusItem<K>
export type StatusListProps = StatusList.StatusListProps

export type ActivityFeedModelProps = ActivityFeed.ActivityFeedModelProps
export type ActivityEvent = ActivityFeed.ActivityEvent
export type ActivityFeedProps = ActivityFeed.ActivityFeedProps
export const { ACTIVITY_COPY, DEFAULT_ACTIVITY_LIMIT } = ActivityFeed

export type PersonListModelProps = PersonList.PersonListModelProps
export type ListedPerson = PersonList.ListedPerson
export type PersonListProps = PersonList.PersonListProps
export const { PERSON_WORDS, DEFAULT_PERSON_LIMIT } = PersonList

export type KeyValueModelProps = KeyValue.KeyValueModelProps
export type KeyValuePair = KeyValue.KeyValuePair
export type KeyValueProps = KeyValue.KeyValueProps
export const { KEY_VALUE_COPY, MAX_PAIRS } = KeyValue

export type CalloutModelProps = Callout.CalloutModelProps
export type CalloutProps = Callout.CalloutProps
export const { CALLOUT_WORDS } = Callout

export type ProgressModelProps = Progress.ProgressModelProps
export type ProgressProps = Progress.ProgressProps
export const { PROGRESS_EMPTY } = Progress

export type ChecklistModelProps = Checklist.ChecklistModelProps
export type ChecklistItem = Checklist.ChecklistItem
export type ChecklistProps = Checklist.ChecklistProps

export type Effect = ActionCard.Effect
export type EffectKind = ActionCard.EffectKind
export type ActionCardModelProps = ActionCard.ActionCardModelProps
export type ActionCardProps = ActionCard.ActionCardProps
