import { MEASURE_IDS } from './measures'
import { SHAPE_NAMES } from './shapes'
import { memoryCache } from './cache/cache'
import { buildContext, type ContextNeeds } from './context'
import type { Scenario } from './github/fixtures'
import { scenario as checks } from './fetchers/rest/checks.record'
import { scenario as commits } from './fetchers/rest/commits.record'
import { scenario as compare } from './fetchers/rest/compare.record'
import { scenario as community } from './fetchers/rest/community.record'
import { scenario as prFiles } from './fetchers/rest/pr-files.record'
import { scenario as readme } from './fetchers/rest/readme.record'
import { scenario as releases } from './fetchers/rest/releases.record'
import { scenario as runTiming } from './fetchers/rest/run-timing.record'
import { scenario as runsByWeek } from './fetchers/rest/workflow-runs-by-week.record'
import { scenario as stats } from './fetchers/stats/stats.record'

/** One instant for the whole next.js context, so every windowed request replays exactly. */
export const CONTEXT_NOW = Date.parse('2026-10-09T09:00:00Z')
export const CONTEXT_ZONE = 'America/Los_Angeles'
export const NEXT = { owner: 'vercel', name: 'next.js' }

/** Every shape and every measure, so one recording serves the measure, derived-shape and context tests. The tree is left out: next.js's runs to megabytes. */
export const EVERYTHING: ContextNeeds = { shapes: SHAPE_NAMES.filter(s => s !== 'tree'), measures: MEASURE_IDS }

const TRIMS: [RegExp, Scenario['trim']][] = [
  [/\/actions\/(workflows\/\d+\/)?runs$/, runsByWeek.trim],
  [/\/actions\/runs\/\d+\/jobs$/, runTiming.trim],
  [/\/check-runs$/, checks.trim],
  [/\/commits$/, commits.trim],
  [/\/compare\//, compare.trim],
  [/\/pulls\/\d+\/files$/, prFiles.trim],
  [/\/pulls\/\d+$/, prFiles.trim],
  [/\/readme$/, readme.trim],
  [/\/(releases|tags)$/, releases.trim],
  [/\/community\/profile$/, community.trim],
  [/\/stats\//, stats.trim],
]

export const scenario: Scenario = {
  name: 'context-nextjs',
  run: client => buildContext(client, memoryCache({ now: () => CONTEXT_NOW }), NEXT, EVERYTHING, { now: CONTEXT_NOW, timeZone: CONTEXT_ZONE }),
  trim(key, body) {
    const path = key.split(' ')[1]?.split('?')[0] ?? ''
    const trim = TRIMS.find(([re]) => re.test(path))?.[1]
    return trim ? trim(key, body) : body
  },
}
