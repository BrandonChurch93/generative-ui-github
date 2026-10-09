// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { check, nextContext } from './testing'
import { draw, without } from './group-b-testing'
import { bindContributorRank } from './ContributorRank'

afterEach(cleanup)

const commits = { title: 'Merged commits by author', measure: 'commits' as const, limit: 8, wallTone: 'risk' as const }

describe('bindContributorRank', () => {
  it('lists everyone with commits in 90 days, with their last commit and a follow-up ask', async () => {
    const { node, warnings } = check(bindContributorRank(await nextContext(), commits))
    expect(node.state).toBe('default')
    expect(warnings).toEqual([])
    const people = (node.props as { people: { handle: string; count: number; lastWords?: string; ask?: string }[] }).people
    expect(people).toHaveLength(13)
    expect(people[0]).toMatchObject({ handle: 'sokra', count: 114, lastWords: 'last commit 1d ago', ask: 'What is sokra working on?' })
    const { container } = draw(node)
    expect(container.textContent).toContain('sokra')
  })

  it('ranks reviewers from reviews on merged pull requests', async () => {
    const { node } = check(bindContributorRank(await nextContext(), { ...commits, measure: 'reviews' }))
    expect((node.props as { people: unknown[] }).people[0]).toMatchObject({ handle: 'lukesandberg', count: 34, lastWords: 'last review 11h ago', ask: 'What is lukesandberg reviewing?' })
  })

  it('is an error when the contributor share was not built', async () => {
    const { node } = check(bindContributorRank(without(await nextContext(), 'contributorShare'), commits))
    expect(node.error).toEqual({ failed: "Couldn't load commit authors", cause: "Not in this answer's data" })
  })
})
