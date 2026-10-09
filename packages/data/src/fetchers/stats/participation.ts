import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { ParticipationShape } from '../../shapes'
import { COUNTING, requestStats, type Counting } from './request'

export function normalizeParticipation(raw: unknown): ParticipationShape {
  const body = (raw ?? {}) as Partial<ParticipationShape>
  return { all: Array.isArray(body.all) ? body.all : [], owner: Array.isArray(body.owner) ? body.owner : [] }
}

export async function fetchParticipation(client: GitHubClient, repo: RepoRef): Promise<ParticipationShape | Counting> {
  const raw = await requestStats<ParticipationShape>(client, repo, 'participation')
  return raw === COUNTING ? COUNTING : normalizeParticipation(raw)
}
