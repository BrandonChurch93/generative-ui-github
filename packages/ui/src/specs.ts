import { actionCardSpec } from './components/ActionCard/schema'
import { insightSpec } from './components/Insight/schema'
import { lineChartSpec } from './components/LineChart/schema'
import { metricSpec } from './components/Metric/schema'
import { timelineSpec } from './components/Timeline/schema'
import { statusListSpec } from './components/StatusList/schema'
import { surfaceSpec } from './components/Surface/schema'
import { sectionSpec } from './components/Section/schema'
import { stackSpec } from './components/Stack/schema'
import { gridSpec } from './components/Grid/schema'
import { splitViewSpec } from './components/SplitView/schema'
import { drawerSpec } from './components/Drawer/schema'
import { tabsSpec } from './components/Tabs/schema'
import { headingSpec } from './components/Heading/schema'
import { textSpec } from './components/Text/schema'
import { listSpec } from './components/List/schema'
import { avatarSpec } from './components/Avatar/schema'
import { buttonSpec } from './components/Button/schema'
import { askSpec } from './components/Ask/schema'
import { contributorRankSpec } from './components/ContributorRank/schema'
import { comparisonSpec } from './components/Comparison/schema'
import { distributionSpec } from './components/Distribution/schema'
import { heatmapSpec } from './components/Heatmap/schema'
import { stepsSpec } from './components/Steps/schema'
import { warmingUpSpec } from './components/WarmingUp/schema'
import { fileTreeSpec } from './components/FileTree/schema'
import { diffViewSpec } from './components/DiffView/schema'
import { createRegistry } from './registry'

// Created here, not in registry.ts, so a hot reload of the specs starts from an empty registry.
/** The one registry the renderer, the composer and the catalog share. */
export const registry = createRegistry()

registry.register(metricSpec)
registry.register(statusListSpec)
registry.register(insightSpec)
registry.register(timelineSpec)
registry.register(lineChartSpec)
registry.register(actionCardSpec)
registry.register(diffViewSpec)
registry.register(fileTreeSpec)
registry.register(warmingUpSpec)
registry.register(stepsSpec)
registry.register(heatmapSpec)
registry.register(distributionSpec)
registry.register(comparisonSpec)
registry.register(contributorRankSpec)
registry.register(surfaceSpec)
registry.register(sectionSpec)
registry.register(stackSpec)
registry.register(gridSpec)
registry.register(splitViewSpec)
registry.register(drawerSpec)
registry.register(tabsSpec)
registry.register(headingSpec)
registry.register(textSpec)
registry.register(listSpec)
registry.register(avatarSpec)
registry.register(buttonSpec)
registry.register(askSpec)

