import type { Scenario } from '../../github/fixtures'
import { fetchRepo } from './repo'

export const scenario: Scenario = {
  name: 'gql-repo',
  run: client => fetchRepo(client, { owner: 'vercel', name: 'next.js' }),
}
