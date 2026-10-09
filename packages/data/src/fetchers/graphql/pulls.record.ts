import type { Scenario } from '../../github/fixtures'
import { fetchPulls } from './pulls'

export const scenario: Scenario = {
  name: 'gql-pulls',
  run: client => fetchPulls(client, { owner: 'vercel', name: 'next.js' }),
}
