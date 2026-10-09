import type { Scenario } from '../../github/fixtures'
import { fetchActivity } from './activity'

/** A Thursday: the fixture's current week is partial, as it is in production. */
export const ACTIVITY_NOW = new Date('2026-10-08T12:00:00Z')

export const scenario: Scenario = {
  name: 'gql-activity',
  run: client => fetchActivity(client, { owner: 'vercel', name: 'next.js' }, { now: ACTIVITY_NOW }),
}
