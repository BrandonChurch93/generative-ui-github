import { metricSpec } from './components/Metric/schema'
import { statusListSpec } from './components/StatusList/schema'
import { registry } from './registry'

registry.register(metricSpec)
registry.register(statusListSpec)

export { registry }
