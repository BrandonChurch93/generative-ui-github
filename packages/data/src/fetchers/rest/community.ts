import type { GitHubClient } from '../../github/client'
import type { RepoRef } from '../../github/resolve'
import type { CommunityShape } from '../../shapes'

type Present = object | null | undefined

interface RestCommunity {
  health_percentage: number
  files: {
    readme?: Present
    contributing?: Present
    code_of_conduct?: Present
    code_of_conduct_file?: Present
    license?: Present
    issue_template?: Present
    pull_request_template?: Present
  }
}

export function toCommunity(raw: RestCommunity): CommunityShape {
  const f = raw.files
  return {
    healthPercentage: raw.health_percentage,
    files: {
      readme: Boolean(f.readme),
      contributing: Boolean(f.contributing),
      // GitHub fills code_of_conduct only when it recognizes the text; the file alone still counts.
      codeOfConduct: Boolean(f.code_of_conduct || f.code_of_conduct_file),
      license: Boolean(f.license),
      issueTemplate: Boolean(f.issue_template),
      pullRequestTemplate: Boolean(f.pull_request_template),
    },
  }
}

export async function fetchCommunity(client: GitHubClient, repo: RepoRef): Promise<CommunityShape> {
  const { data } = await client.rest<RestCommunity>('GET /repos/{owner}/{repo}/community/profile', { owner: repo.owner, repo: repo.name })
  return toCommunity(data)
}
