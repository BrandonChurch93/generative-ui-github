import { metricSpec } from './components/Metric/schema'
import { registry } from './registry'

registry.register(metricSpec)

export { registry }
