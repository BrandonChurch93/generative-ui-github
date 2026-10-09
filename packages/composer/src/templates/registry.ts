import { biggestPr } from './golden/biggest-pr'
import { ciTrend } from './golden/ci-trend'
import { contributors } from './golden/contributors'
import { mergedRecent } from './golden/merged-recent'
import { monthCompare } from './golden/month-compare'
import { newContributor } from './golden/new-contributor'
import { overview } from './golden/overview'
import { punchCard } from './golden/punch-card'
import { releaseBlockers } from './golden/release-blockers'
import { releaseDiff } from './golden/release-diff'
import { responsiveness } from './golden/responsiveness'
import { staleIssues } from './golden/stale-issues'
import { checkFailures } from './follow/check-failures'
import { person } from './follow/person'
import { prDetail } from './follow/pr-detail'
import type { TemplateId } from './needs'
import type { Template } from './template'

/** Every template by id. */
export const TEMPLATES: Partial<Record<TemplateId, Template>> = {
  overview,
  'release-blockers': releaseBlockers,
  contributors,
  'ci-trend': ciTrend,
  'merged-recent': mergedRecent,
  'stale-issues': staleIssues,
  'biggest-pr': biggestPr,
  'new-contributor': newContributor,
  responsiveness,
  'month-compare': monthCompare,
  'punch-card': punchCard,
  'release-diff': releaseDiff,
  'check-failures': checkFailures,
  'pr-detail': prDetail,
  person,
}
