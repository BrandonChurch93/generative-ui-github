import { isBot, type Pull } from '@genui-github/data'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'
import { missingData, ref, shape } from './group-a-shared'
import { KEY_VALUE_COPY, MAX_PAIRS, type KeyValueModelProps, type KeyValuePair, type KeyValueProps } from './group-a-ui'

// KeyValue: the model names the thing (the repo, a pull request, a release); the system fills the facts.

type Read = { title: string; meta?: string; pairs: KeyValuePair[] } | { failed: string; cause: string } | { empty: string; emptyMeta?: string }

const pair = (key: string, label: string, value: string | number, kind?: KeyValuePair['kind']): KeyValuePair => ({ key, label, value, ...(kind ? { kind } : {}) })

function repoFacts(ctx: DataContext): Read {
  const repo = shape(ctx, 'repo')
  if (!repo) return missingData(ctx, KEY_VALUE_COPY.repo.failed, ['repo'])
  const activity = shape(ctx, 'activity')
  const latest = shape(ctx, 'releases')?.releases[0]
  const pairs = [
    pair('default-branch', 'Default branch', repo.defaultBranch, 'identifier'),
    ...(repo.primaryLanguage ? [pair('language', 'Primary language', repo.primaryLanguage)] : []),
    pair('stars', 'Stars', repo.stars, 'count'),
    pair('forks', 'Forks', repo.forks, 'count'),
    pair('open-issues', 'Open issues', activity?.open.issues ?? repo.openIssues, 'count'),
    ...(activity ? [pair('open-prs', 'Open pull requests', activity.open.pulls, 'count')] : []),
    ...(latest ? [pair('latest-release', 'Latest release', latest.tag, 'identifier')] : []),
    pair('pushed', 'Last push', repo.pushedAt, 'time'),
    pair('created', 'Created', repo.createdAt, 'time'),
  ]
  return { title: `${repo.owner}/${repo.name}`, meta: ['public', repo.license].filter(Boolean).join(' · '), pairs }
}

const PR_STATE: Record<NonNullable<Pull['reviewDecision']> | 'none', string> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes requested',
  REVIEW_REQUIRED: 'review pending',
  none: 'review pending',
}

function prFacts(ctx: DataContext, pr: number | undefined): Read {
  if (pr === undefined) return { failed: KEY_VALUE_COPY.pr.failed, cause: 'No pull request was named' }
  const pulls = shape(ctx, 'pulls')
  const biggest = shape(ctx, 'biggestOpenPr')?.pull
  const pull = [...(pulls?.open ?? []), ...(pulls?.merged ?? []), ...(biggest ? [biggest] : [])].find(p => p.number === pr)
  if (!pull) {
    if (!pulls) return missingData(ctx, KEY_VALUE_COPY.pr.failed, ['pulls'])
    return { failed: KEY_VALUE_COPY.pr.failed, cause: `${ref(pr)} is not in this answer's data` }
  }
  const reviews = pull.reviews.filter(r => !isBot(r.author) && r.author.login !== pull.author.login).length
  const state = pull.mergedAt ? 'merged' : pull.closedAt ? 'closed' : pull.draft ? 'open · draft' : `open · ${PR_STATE[pull.reviewDecision ?? 'none']}`
  const pairs = [
    pair('author', 'Author', pull.author.login, 'identifier'),
    pair('head', 'Head', pull.headRef, 'identifier'),
    pair('files', 'Files changed', pull.changedFiles, 'count'),
    pair('lines', 'Lines changed', pull.additions + pull.deletions, 'count'),
    pair('reviews', 'Reviews', reviews, 'count'),
    ...(pull.milestone ? [pair('milestone', 'Milestone', pull.milestone, 'identifier')] : []),
    pair('opened', 'Opened', pull.createdAt, 'time'),
    ...(pull.mergedAt ? [pair('merged', 'Merged', pull.mergedAt, 'time')] : [pair('updated', 'Last update', pull.updatedAt, 'time')]),
  ]
  return { title: `Pull request ${ref(pull.number)}`, meta: state, pairs }
}

function releaseFacts(ctx: DataContext, tag: string | undefined): Read {
  const releases = shape(ctx, 'releases')
  if (!releases) return missingData(ctx, KEY_VALUE_COPY.release.failed, ['releases'])
  if (!releases.releases.length) {
    const latestTag = releases.tags[0]?.name
    return { empty: KEY_VALUE_COPY.release.empty, ...(latestTag ? { emptyMeta: `${releases.tags.length} tags · latest tag ${latestTag}` } : {}) }
  }
  const at = tag ? releases.releases.findIndex(r => r.tag === tag) : 0
  if (at < 0) return { failed: KEY_VALUE_COPY.release.failed, cause: `${tag} is not among the listed releases` }
  const release = releases.releases[at]!
  const previous = releases.releases[at + 1]
  const between = shape(ctx, 'commitsBetweenTags')
  const diff = between && between.head === release.tag ? between : undefined
  const pairs = [
    pair('tag', 'Tag', release.tag, 'identifier'),
    ...(release.name && release.name !== release.tag ? [pair('name', 'Name', release.name)] : []),
    pair('published', 'Published', release.publishedAt, 'time'),
    pair('kind', 'Kind', release.prerelease ? 'Prerelease' : 'Release'),
    ...(previous ? [pair('previous', 'Previous release', previous.tag, 'identifier')] : []),
    ...(diff ? [pair('commits', 'Commits since previous', diff.commits.length, 'count'), pair('files', 'Files changed', diff.totals.changedFiles, 'count')] : []),
  ]
  return { title: `Release ${release.tag}`, meta: at === 0 ? 'latest' : `older than ${releases.releases[0]!.tag}`, pairs }
}

export const bindKeyValue: Binder<KeyValueModelProps> = (ctx, props, extras = {}) => {
  const frame: KeyValueProps = { source: props.source, pairs: [], now: new Date(ctx.now).toISOString() }
  const read = props.source === 'repo' ? repoFacts(ctx) : props.source === 'pr' ? prFacts(ctx, props.scope?.pr) : releaseFacts(ctx, props.scope?.tag)
  if ('failed' in read) return unavailable('KeyValue', props, frame, read, extras)
  if ('empty' in read) return empty('KeyValue', props, { ...frame, empty: read.empty, emptyTone: 'neutral', ...(read.emptyMeta ? { emptyMeta: read.emptyMeta } : {}) }, extras)
  const boundProps: KeyValueProps = { ...frame, title: read.title, pairs: read.pairs.slice(0, MAX_PAIRS), ...(read.meta ? { meta: read.meta } : {}) }
  return bound('KeyValue', props, boundProps, extras)
}
