import type { Scenario } from '../../github/fixtures'
import { fetchMilestones } from './milestones'

export const scenario: Scenario = {
  name: 'gql-milestones',
  run: client => fetchMilestones(client, { owner: 'vercel', name: 'next.js' }),
}
