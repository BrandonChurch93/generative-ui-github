import { describe, expect, it } from 'vitest'
import { nextContext } from '../bind/testing'
import { TEMPLATE_NEEDS, type TemplateId } from './needs'
import { TEMPLATES } from './registry'
import { checkTree, chose, templateBuilt, toComposition, type TemplateParams } from './template'

// Each follow-up template from the click that reaches it, on the recorded next.js context.
const CLICKS: { id: TemplateId; ask: string; from: string; params: TemplateParams; scope?: Record<string, unknown> }[] = [
  { id: 'check-failures', ask: 'Which checks are failing on canary?', from: 'metric:failing-checks', params: { branch: 'canary' } },
  { id: 'pr-detail', ask: "What's holding #99178?", from: 'statuslist:pull:all', params: { pr: 99178 }, scope: { pr: 99178 } },
  { id: 'person', ask: 'What has sokra been working on?', from: 'rank:commits:90d', params: { handle: 'sokra' }, scope: { author: 'sokra' } },
]

describe('the follow-up templates, from a click', () => {
  for (const click of CLICKS) {
    it(`${click.id}: ${click.ask}`, async () => {
      const base = await nextContext()
      const ctx = click.scope ? { ...base, scope: click.scope } : base
      const screen = TEMPLATES[click.id]!.compose(ctx, click.params)
      const composition = toComposition(click.id, screen, templateBuilt(click.id, ctx, chose(screen.regions)))
      expect(checkTree(composition, { question: click.ask }).problems).toEqual([])
      expect(TEMPLATE_NEEDS[click.id].kind).toBe('follow-up')
    })
  }

  it('check-failures re-emphasizes the CI chart, the survivor of the release-blockers screen', async () => {
    const screen = TEMPLATES['check-failures']!.compose(await nextContext(), { branch: 'canary' })
    expect(screen.regions.side[0]).toMatchObject({ id: 'linechart:ci-p50', emphasis: 'high' })
    expect(screen.regions.metrics[0]!.id).toBe('metric:failing-checks')
  })
})
