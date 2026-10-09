import { insightSpec } from './components/Insight/schema'
import { metricSpec } from './components/Metric/schema'
import { statusListSpec } from './components/StatusList/schema'
import { registry } from './registry'

registry.register(metricSpec)
registry.register(statusListSpec)
registry.register(insightSpec)

export { registry }
