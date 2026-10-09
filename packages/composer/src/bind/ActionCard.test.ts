// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw } from './group-a-testing'
import { bindActionCard } from './ActionCard'

afterEach(cleanup)

const nudge = {
  heading: 'Ask for reviews on two pull requests',
  body: 'Drafts a review request on #93511 and #95913. Nothing merges and nothing is posted.',
  primary: 'Request reviews',
  effect: { kind: 'request-review' as const, targets: ['#93511', '#95913'] },
}

describe('bindActionCard', () => {
  it('binds sample mode and lets the body cite its targets', async () => {
    const ctx = await nextContext()
    const { node, warnings } = check(bindActionCard(ctx, nudge), 'action')
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    expect(node.id).toBe('actioncard:request-review:#93511+#95913')
    expect(node.props).toMatchObject({ mode: 'sample', body: nudge.body })
    expect(draw(node).container.textContent).toContain('Request reviews')
  })

  it('accepts a re-run of a check in the data and refuses targets that are not what the effect acts on', async () => {
    const ctx = await nextContext()
    const rerun = { ...nudge, heading: 'Re-run the failed build', primary: 'Re-run', effect: { kind: 'rerun-checks' as const, targets: ['create-pull-request'] } }
    expect(check(bindActionCard(ctx, rerun), 'action').node.state).toBe('default')

    const wrong = check(bindActionCard(ctx, { ...rerun, effect: { kind: 'rerun-checks', targets: ['#93511'] } }), 'action').node
    expect(wrong.state).toBe('error')
    expect(wrong.error).toEqual({ failed: "Couldn't draft the re-runs", cause: '#93511 is a pull request, not a check' })
    draw(wrong)
    const issue = check(bindActionCard(ctx, { ...nudge, effect: { kind: 'request-review', targets: ['#99830'] } }), 'action').node
    expect(issue.error?.cause).toBe('#99830 is an issue, not a pull request')
  })
})
