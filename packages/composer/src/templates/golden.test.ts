import { describe, expect, it } from 'vitest'
import { SAMPLE_REPOS } from '@genui-github/data/server'
import { sampleContext } from '../samples'
import { needsFor, TEMPLATE_IDS, TEMPLATE_NEEDS } from './needs'
import { TEMPLATES } from './registry'
import { checkTree, chose, templateBuilt, toComposition } from './template'

const golden = TEMPLATE_IDS.filter(id => TEMPLATE_NEEDS[id].kind === 'golden' && TEMPLATES[id])

describe('the golden templates on every sample repo, with no model call and no GitHub call', () => {
  for (const id of golden) {
    for (const repo of SAMPLE_REPOS) {
      it(`${id} · ${repo.owner}/${repo.name}`, async () => {
        const { ctx, calls } = await sampleContext(repo, needsFor(id), { timeZone: 'America/Los_Angeles' })
        const screen = TEMPLATES[id]!.compose(ctx, {})
        const composition = toComposition(`${id}-${repo.name}`, screen, templateBuilt(id, ctx, chose(screen.regions)))
        const check = checkTree(composition, { question: TEMPLATE_NEEDS[id].question })
        expect(check.problems).toEqual([])
        expect(calls).toEqual([])
        expect(screen.regions.insight).toHaveLength(1)
      })
    }
  }
})
