import { bindBarChart } from './BarChart'
import { bindComparison } from './Comparison'
import { bindContributorRank } from './ContributorRank'
import { bindDistribution } from './Distribution'
import { bindHeatmap } from './Heatmap'
import { bindLineChart } from './LineChart'

export const BINDERS_B = {
  LineChart: bindLineChart,
  BarChart: bindBarChart,
  Distribution: bindDistribution,
  Comparison: bindComparison,
  Heatmap: bindHeatmap,
  ContributorRank: bindContributorRank,
} as const
