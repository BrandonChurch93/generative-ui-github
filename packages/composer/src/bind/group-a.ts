import { bindActionCard } from './ActionCard'
import { bindActivityFeed } from './ActivityFeed'
import { bindCallout } from './Callout'
import { bindChecklist } from './Checklist'
import { bindInsight } from './Insight'
import { bindKeyValue } from './KeyValue'
import { bindMetric } from './Metric'
import { bindPersonList } from './PersonList'
import { bindProgress } from './Progress'
import { bindStatusList } from './StatusList'

/** Group A's binders, by component name. */
export const BINDERS_A = {
  Insight: bindInsight,
  Metric: bindMetric,
  StatusList: bindStatusList,
  ActivityFeed: bindActivityFeed,
  PersonList: bindPersonList,
  KeyValue: bindKeyValue,
  Callout: bindCallout,
  Progress: bindProgress,
  Checklist: bindChecklist,
  ActionCard: bindActionCard,
} as const
