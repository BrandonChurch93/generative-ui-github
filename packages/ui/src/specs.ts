import { insightSpec } from './components/Insight/schema'
import { lineChartSpec } from './components/LineChart/schema'
import { metricSpec } from './components/Metric/schema'
import { timelineSpec } from './components/Timeline/schema'
import { statusListSpec } from './components/StatusList/schema'
import { registry } from './registry'

registry.register(metricSpec)
registry.register(statusListSpec)
registry.register(insightSpec)
registry.register(timelineSpec)
registry.register(lineChartSpec)

export { registry }
