import type { Scenario } from '../../github/fixtures'
import { fetchIssues } from './issues'

export const scenario: Scenario = {
  name: 'gql-issues',
  run: client => fetchIssues(client, { owner: 'vercel', name: 'next.js' }),
}
