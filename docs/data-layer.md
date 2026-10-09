# Data layer

`packages/data`. Everything the composer can see comes through here, normalized, cached and typed. Nothing in this package knows about components.

## Endpoints

GraphQL for entity fetches that would need several REST calls; REST for stats, Actions, checks, compare and file contents.

| Shape | Source | Notes |
| --- | --- | --- |
| `repo` | GraphQL `repository` | name, description, topics, license, default branch, stars, forks, watchers, open issues, created, pushed, primary language, languages |
| `pulls` | GraphQL: the 50 most recently updated open (`first: 50` alone returns the 50 oldest), and the 100 newest merged, in pages of 50 (one query for all 150 timed out) | title, author, authorAssociation, draft, labels, reviewDecision, reviews and comments (first human other than the author, bots excluded), createdAt, updatedAt, mergedAt, closedAt, additions, deletions, changedFiles, milestone, headRef |
| `issues` | GraphQL: the 50 most and 50 least recently updated open issues, and the 50 most recently closed | title, author, labels, assignees, comments count and first human comment, reactions, createdAt, updatedAt, closedAt, milestone; good-first = labels matching /good.first/i or /help.wanted/i |
| `activity` | GraphQL `search(type: ISSUE) { issueCount }`, about 70 aliases in one query, 1 point | exact counts the capped lists cannot give: opened, closed and merged per week for 12 weeks, merged per month for last month and this one, and today's open, draft, awaiting-review, changes-requested, stale and good-first counts |
| `milestones` | GraphQL `milestones(states: OPEN)` | title, due, open/closed counts (issues and pulls). The next milestone is the open one due soonest; an undated milestone ("backlog") is never the next release |
| `releases` | REST `/releases?per_page=10` + `/tags?per_page=10` | name, tag, date, prerelease, body. Tags mix in package tags (next.js: `@vercel/devlow-bench@0.3.4`), so release pairs come from releases: the last two stable, or the last two of any kind when a repo ships only prereleases |
| `community` | REST `/community/profile` | README, CONTRIBUTING, CODE_OF_CONDUCT, license, templates, health percentage. GitHub does not count YAML issue forms as templates, so next.js reports none |
| `commits` | REST `/commits?per_page=100&since=` (and `author=` for one person) | sha, author login, date (committer date), message; `truncated` when the page is full (next.js fills 100 in three days). Repo-wide commit counts come from `stats.commitActivity` |
| `workflowRuns` | REST: the CI workflow is the one with the most push runs among the latest 100 push runs on the default branch; then `/actions/workflows/{id}/runs?branch=&created=<week>` for each of 12 weeks, up to 3 pages a week | id, workflow name, status, conclusion, run_attempt, run_started_at, updated_at; duration = updated − run_started, except runs over a day or updated in bulk (3 or more ending in the same second, which GitHub does weeks later), which carry no duration. The latest 100 runs of every workflow cover about 7 hours on next.js and are mostly automation |
| `runTiming` | REST `/actions/runs/{id}/jobs` (`/timing` gives only billable minutes, zero on a public repo, and no steps) | job and step durations, for the slowest run of the last 30 days (older runs' jobs are often gone) |
| `checks` | REST `/commits/{ref}/check-runs`, up to 10 pages | name, status, conclusion, started, completed; `truncated` past 10 pages (next.js's head has 420) |
| `compare` | REST `/compare/{base}...{head}` | commits between (GitHub stops at 250), files changed (at most 300) without patches; totals are summed from the files |
| `prFiles` | REST `/pulls/{n}/files?per_page=100`, up to 30 pages | path, additions, deletions, patch (cut at 1,001 lines, one past DiffView's stop); GitHub lists at most 3,000 files |
| `tree` | REST `/git/trees/{sha}?recursive=1` | paths; truncated flag |
| `readme` | REST `/readme` | decoded |
| `stats.commitActivity` | REST `/stats/commit_activity` | 52 weeks, per-day counts, Sunday first |
| `stats.codeFrequency` | REST `/stats/code_frequency` | adds/deletes per week; 422 at 10,000+ commits (verify) |
| `stats.participation` | REST `/stats/participation` | owner vs all, 52 weeks, oldest first |
| `stats.punchCard` | REST `/stats/punch_card` | day × hour counts, Sunday first as returned; the data layer reorders Monday first and shifts to the viewer's zone; all-time (verify windowing) |
| `stats.contributors` | REST `/stats/contributors` (now returns up to 500 authors) | the top 100 authors, all-time total, and only the weeks with work in the last 52 |

All stats exclude merge commits. Traffic endpoints are not used (need push access).

## 202 handling

Stats endpoints return 202 with a body of `{}` while GitHub compiles. Rules:

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

Computed in `packages/data/src/chaoss.ts` from the shapes above. All exclude accounts flagged as bots: a GitHub App (`__typename: Bot`, REST `type: Bot`, or a login ending in `[bot]`), or a plain account named for automation, ending in `-bot` or `_bot` (`nextjs-bot`, `vercel-release-bot`, which is next.js's fourth-largest committer).

- **Time to first response** (issues and PRs): opened → first comment, review, or merge by a human other than the author. Median and p90 over the window. A merge counts as a response.
- **Change request closure ratio** per period: closed (merged or closed) ÷ opened in the same period. Below 1 means falling behind.
- **Time to close**: opened → merged or closed, median over the window.
- **Bus factor**: smallest number of contributors whose commits (or reviews) sum to 50% of the total in the window.
- **Contributor absence factor**: same as bus factor but the system's name for it in prose is "bus factor".
- **Core vs community share**: the share of merged pull requests whose author is an OWNER, MEMBER or COLLABORATOR, per week. GitHub's `participation.owner` counts only the owner account's own commits, which for an organization's repo is close to none; it is the fallback when a repo has no merged pull requests.

## Measures

Every id in the measure catalog (`docs/schemas.md`) is computed in `packages/data/src/compute.ts` from the shapes above, for a repo and a window, and returns `{ value, unit, formatted, series12w?, coveredFrom?, cachedAt }`. Counts come from `activity`'s search counts where one exists. A figure read from a capped list covers only from where the list is complete: `coveredFrom` says so, and `series12w` is left out unless all twelve weeks are covered. A missing value is null, never a zero.

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

- Memory backend for dev and as a fallback; Vercel KV (Upstash Redis) when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both set.
- Keys: `repo:{owner}/{name}:{shape}` and `stats:{owner}/{name}:{sha}:{shape}`.
- TTL 900s for live repos; `null` (never) for sample repos.
- Every returned shape carries `cachedAt` so the UI can say "copy from Oct 5".

## Sample repos

`pnpm samples:refresh` runs the full context build for each of the five repos for every template, computes CHAOSS, and writes one JSON per repo to `packages/data/samples/`. The app loads these at startup into the cache with no TTL. The script prints the GitHub request count so the owner knows the cost of a refresh (expect 60 to 120 requests per repo).

The anonymized-handle rule applies only to `sample.json` in components (the catalog). Sample repos in the app are real data about real repos; that is the point.

## Facts to verify in task 4.5

Record the answer, the date, and the call used:

- [x] 202 is returned only by `/stats/*`. **Yes, for every endpoint we read** (2026-10-09). Across all recorded fixtures (`pnpm facts:verify --only=1`), only `/stats/code_frequency`, `/stats/commit_activity`, `/stats/participation` and `/stats/punch_card` ever answered 202; every other endpoint answered 200 (or 404 for a missing repo). The 202 body is `{}`, not empty.
- [x] Stats are cached by GitHub per default-branch SHA. **Yes, with a qualification** (2026-10-09). `vitejs/vite`'s stats answered 200 at about 07:22 UTC; a push to `main` landed at 07:30:54 (`52ba877`); from then on `/stats/commit_activity` and `/stats/contributors` answered 202 for more than 20 minutes, while `/stats/participation` and `/stats/punch_card` kept answering 200. A push can reset some stats, and the recount can far outlast our 120-second schedule, which is why a stopped check shows the last dated copy. (next.js's canary had no push in a 30-minute window, so the observation is on vite.)
- [x] `/stats/code_frequency` returns 422 at 10,000 or more commits. **Yes** (2026-10-09). `vercel/next.js` and `react/react` answer 422 ("repository must have fewer than 10000 commits"); `vitejs/vite` (under 10,000) answers 202, then 200.
- [x] `/stats/punch_card` is all-time. **Yes, up to 20,000 commits** (2026-10-09). vite's punch card holds 9,692 commits against 1,223 in the last 52 weeks of `/stats/commit_activity` and 8,986 all-time in `/stats/contributors` (top authors only); tailwindcss: 6,051 against 392 and 6,298. next.js's cells sum to exactly 20,000, a cap.
- [x] `/pulls/{n}/files` caps at 3,000 files. **Yes** (2026-10-09). `nodejs/node#65161` ("deps: update V8 to 15.2") changes 8,161 files; `/pulls/65161/files?per_page=100` lists exactly 3,000 over 30 pages, and page 31 is empty.
