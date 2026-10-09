import releaseBlockers from '../fixtures/1-release-blockers.json'
import checkFailures from '../fixtures/2-check-failures.json'
import contributors from '../fixtures/3-contributors.json'
import type { Composition } from './format'

/** The three compositions from docs/composer.md, with the system-bound values the renderer needs. Test data only. */
export const FIXTURES = {
  releaseBlockers: releaseBlockers as Composition,
  checkFailures: checkFailures as Composition,
  contributors: contributors as Composition,
} as const
