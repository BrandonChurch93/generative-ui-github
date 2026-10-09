# Data layer

`packages/data`. Everything the composer can see comes through here, normalized, cached and typed. Nothing in this package knows about components.

## Endpoints

GraphQL for entity fetches that would need several REST calls; REST for stats, Actions, checks, compare and file contents.

| Shape | Source | Notes |
| --- | --- | --- |
| `repo` | GraphQL `repository` | name, description, topics, license, default branch, stars, forks, watchers, open issues, created, pushed, primary language, languages |
| `pulls` | GraphQL `pullRequests(states: OPEN, first: 50)` + `(states: MERGED, last: 100)` | title, author, draft, labels, reviewDecision, reviews (first human, bots excluded), createdAt, updatedAt, mergedAt, closedAt, additions, deletions, changedFiles, milestone, headRef |
| `issues` | GraphQL `issues(states: OPEN, first: 100)` | title, author, labels, assignees, comments count, reactions, createdAt, updatedAt, milestone; good-first = labels matching /good.first/i or /help.wanted/i |
| `milestones` | GraphQL `milestones(states: OPEN)` | title, due, open/closed counts |
| `releases` | REST `/releases?per_page=10` + `/tags?per_page=10` | name, tag, date, prerelease, body |
| `community` | REST `/community/profile` | README, CONTRIBUTING, CODE_OF_CONDUCT, license, templates, health percentage |
| `commits` | REST `/commits?per_page=100&since=` | sha, author login, date, message; stats per commit only when needed (expensive) |
| `workflowRuns` | REST `/actions/runs?per_page=100&branch=<default>` | id, workflow name, status, conclusion, run_started_at, updated_at; duration = updated − run_started |
| `runTiming` | REST `/actions/runs/{id}/timing` | job and step durations, only for the slowest-run drill-down |
| `checks` | REST `/commits/{ref}/check-runs` | name, status, conclusion, started, completed |
| `compare` | REST `/compare/{base}...{head}` | commits between, files changed, totals |
| `prFiles` | REST `/pulls/{n}/files?per_page=100` | path, additions, deletions, patch; cap 3,000 files (verify in 4.5) |
| `tree` | REST `/git/trees/{sha}?recursive=1` | paths; truncated flag |
| `readme` | REST `/readme` | decoded |
| `stats.commitActivity` | REST `/stats/commit_activity` | 52 weeks, per-day counts, Sunday first |
| `stats.codeFrequency` | REST `/stats/code_frequency` | adds/deletes per week; 422 at 10,000+ commits (verify) |
| `stats.participation` | REST `/stats/participation` | owner vs all, 52 weeks, oldest first |
| `stats.punchCard` | REST `/stats/punch_card` | day × hour counts, Sunday first as returned; the data layer reorders Monday first and shifts to the viewer's zone; all-time (verify windowing) |
| `stats.contributors` | REST `/stats/contributors` | top 100 authors, weekly a/d/c |

All stats exclude merge commits. Traffic endpoints are not used (need push access).

## 202 handling

Stats endpoints return 202 with an empty body while GitHub compiles. Rules:

- A 202 is reported through `WarmingStatus` (`docs/schemas.md`) with `phase: 'warming'`, never as an error.
- Check schedule, matching the WarmingUp component's lanes: checks at 0, 4, 10, 18, 28, 40, 54, 70, 90 and 120 seconds after the first request. After the 120s check: `phase: 'stopped'`, and each stat returns its cached copy with `cachedAt` if one exists (`state: 'cached'`), else `state: 'missing'`.
- The WarmingUp component is driven by the `WarmingStatus` type defined in `docs/schemas.md`, which the context builder exposes.
- Stats are cached by GitHub per default-branch SHA; a push resets them. Our cache key for stats includes that SHA so we never serve stats for an old head.

## Rate limits

- Authenticated: 5,000 REST requests per hour, GraphQL 5,000 points per hour. Log `x-ratelimit-remaining` on every response at debug level; warn under 500.
- A 403 with `retry-after` or `x-ratelimit-reset` is `GitHubError { status: 403, resetAt }`. The shell renders the RateLimit screen with the real reset time.
- A 502/503/504 is retried twice with 1s and 3s delays, then `GitHubError`. The error state says "GitHub returned 502 · tried twice".

## Repo resolver cases

Input → result:

1. `vercel/next.js` → ok
2. `https://github.com/vercel/next.js` → ok
3. `https://github.com/vercel/next.js/pulls` → ok (path stripped)
4. `github.com/vercel/next.js.git` → ok (`.git` stripped)
5. `  Vercel/Next.js  ` → ok (trimmed; GitHub is case-insensitive, keep the canonical casing from the API)
6. `vercel` → "Needs owner/name, like vercel/next.js"
7. `vercel/next.js/extra/deep` → ok (first two segments)
8. a private or missing repo (404) → "That repo is private or doesn't exist"
9. `https://gitlab.com/x/y` → "Only github.com repos"
10. an empty string → "Paste a public GitHub repo"

## CHAOSS metrics

Computed in `packages/data/src/chaoss.ts` from the shapes above. All exclude accounts flagged as bots (login ending in `[bot]`, or `__typename: Bot`).

- **Time to first response** (issues and PRs): opened → first comment, review, or merge by a human other than the author. Median and p90 over the window. A merge counts as a response.
- **Change request closure ratio** per period: closed (merged or closed) ÷ opened in the same period. Below 1 means falling behind.
- **Time to close**: opened → merged or closed, median over the window.
- **Bus factor**: smallest number of contributors whose commits (or reviews) sum to 50% of the total in the window.
- **Contributor absence factor**: same as bus factor but the system's name for it in prose is "bus factor".
- **Core vs community share**: owner-org members' commits ÷ all, per week, from `participation` where available, else from `contributors`.

## Measures

Every id in the measure catalog (`docs/schemas.md`) is computed in `packages/data/src/measures.ts` from the shapes above, for a repo and a window, and returns `{ value, unit, formatted, series12w?, cachedAt }`.

## Derived shapes the templates need

| Derived | From | Used by |
| --- | --- | --- |
| `ciDurationByWeek` (p50, p90, count, failures) | workflowRuns | ci-trend, release-blockers |
| `failureRateByWeek` | workflowRuns | ci-trend |
| `slowestJob` | runTiming of the slowest run | ci-trend |
| `staleIssues` (last activity > 30d, sorted) | issues | stale-issues |
| `goodFirstIssues` | issues | new-contributor |
| `biggestOpenPr` | pulls | biggest-pr |
| `blockingPrs` (open on the next milestone, by wait) | pulls, milestones | release-blockers |
| `commitsBetweenTags` | releases, compare | release-diff |
| `busiestHour`, `quietestDay` | punchCard | punch-card |
| `mergedByDay` (window) | pulls merged | merged-recent |
| `contributorShare` (90d, commits and reviews) | contributors, pulls | contributors, responsiveness |
| `monthCompare` (4 measures) | pulls, workflowRuns, issues | month-compare |

## Cache

One interface, two backends:

```ts
interface Cache {
  get<T>(key: string): Promise<{ value: T; cachedAt: string } | null>
  set<T>(key: string, value: T, ttlSeconds: number | null): Promise<void>
}
```

- Memory backend for dev and as a fallback; Vercel KV when `KV_URL` is set.
- Keys: `repo:{owner}/{name}:{shape}` and `stats:{owner}/{name}:{sha}:{shape}`.
- TTL 900s for live repos; `null` (never) for sample repos.
- Every returned shape carries `cachedAt` so the UI can say "copy from Oct 5".

## Sample repos

`pnpm samples:refresh` runs the full context build for each of the five repos for every template, computes CHAOSS, and writes one JSON per repo to `packages/data/samples/`. The app loads these at startup into the cache with no TTL. The script prints the GitHub request count so the owner knows the cost of a refresh (expect 60 to 120 requests per repo).

The anonymized-handle rule applies only to `sample.json` in components (the catalog). Sample repos in the app are real data about real repos; that is the point.

## Facts to verify in task 4.5

Record the answer, the date, and the call used:

- [ ] 202 is returned only by `/stats/*`.
- [ ] Stats are cached by GitHub per default-branch SHA (push, then observe a 202).
- [ ] `/stats/code_frequency` returns 422 at 10,000 or more commits (try on a large repo).
- [ ] `/stats/punch_card` is all-time (compare against a windowed count).
- [ ] `/pulls/{n}/files` caps at 3,000 files.
