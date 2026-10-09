# Golden questions

Twelve questions the app must answer well. Each is a layout template the classifier can pick (fast path, Haiku, ~300ms) and a row in the eval set. Every component in the catalog is here because at least one question needs it.

The phrasing is how a person would type it. The chips on the landing page use these words.

| # | Question | Template id | Data shapes | Components the template uses |
| --- | --- | --- | --- | --- |
| 1 | How's this repo doing? | `overview` | overview | Insight, Metric ×4 (with trend), StatusList (kind: pull) in main, LineChart (commits per week) in side with Checklist (community standards) stacked below |
| 2 | What's blocking the next release? | `release-blockers` | status | Insight, Metric ×4 (two hot), StatusList (kind: pull, sorted by wait) in main, LineChart (CI p50 with failure strip) in side, ActionCard (request-review) |
| 3 | Who's carrying this repo? | `contributors` | people | Insight, Metric ×3 (contributors, bus factor, core share), ContributorRank in main, LineChart (core vs community, two series) in side with Heatmap (when commits land) stacked below |
| 4 | Is CI getting slower? | `ci-trend` | time series | Insight, Metric ×3 (p50, failure rate, slowest job), StatusList (kind: workflow) in main, LineChart (duration with failure strip) in side with Comparison (this month vs last) stacked below |
| 5 | What's been merged this week? | `merged-recent` | timeline | Insight, Metric ×2, Timeline (grouped by day) in main, PersonList (who merged, 5 rows) in side |
| 6 | Which issues have gone stale? | `stale-issues` | table + filters | Insight, Metric ×2, FilterChips (window) above a StatusList (kind: issue, sorted by activity) in main, BarChart (stale by label) in side, ActionCard (add-label) |
| 7 | Show me the biggest open PR | `biggest-pr` | code | Insight, Metric ×3 (size, files, wait), FileTree in side, DiffView (folded) in main, StatusList (kind: check) stacked below the DiffView |
| 8 | Where would a new contributor start? | `new-contributor` | guidance | Insight, Steps in main, Distribution (time to first review, reader) in side with Checklist stacked below; the good-first issues are the Steps' links, not a second list |
| 9 | How responsive are the maintainers? | `responsiveness` | CHAOSS | Insight, Metric ×3 (TTFR median, closure ratio, time to close), ContributorRank (reviews) in main, Distribution (TTFR) in side with LineChart (closure ratio over 12 weeks) stacked below |
| 10 | Compare this month to last | `month-compare` | comparison | Insight, Metric ×2 (with trend), Comparison (4 pairs) in main, StatusList (kind: workflow, with row trends) in side |
| 11 | When does this project get worked on? | `punch-card` | heatmap | Insight, Metric ×2 (busiest hour, quietest day), Heatmap (12 weeks) in main, PersonList (most active, 5 rows) in side |
| 12 | What changed between the last two releases? | `release-diff` | release diff | Insight, Metric ×3 (commits, contributors, files), Timeline (commits between tags) in main, FileTree (changed areas) in side; contributors are a Metric, not a rank |

## Landing page groups

The twelve chips on the landing are grouped by what they reveal:

- Shipping: 2 release blockers · 5 merged this week · 12 between releases
- Health: 4 CI slower · 9 responsiveness · 10 month compare
- People: 3 who's carrying · 11 when worked on · 6 stale issues
- Getting started: 8 new contributor · 1 how's it doing · 7 biggest PR

## Follow-up questions a click produces

Every clickable piece carries an `ask` the composer answers. These are the ones the templates emit by default; the composer may phrase others.

- A Metric "Failing checks" → "Which checks are failing on `<branch>`?" (template `check-failures`: Insight, Metric ×4, StatusList kind: check in main, LineChart with the failure strip emphasized in side, ActionCard rerun-checks)
- A StatusList pull row → "What's holding #`<n>`?" (template `pr-detail`: Insight, Metric ×3, DiffView folded in main with StatusList kind: check stacked below, FileTree in side, ActionCard request-review)
- A ContributorRank row → "What has `<handle>` been working on?" (template `person`: Insight, Metric ×3, Timeline of their merges in main, StatusList kind: pull of their open PRs in side)
- A Timeline day heading (`dayAsk`) → "What merged on `<day>`?" (template `merged-recent` with the window narrowed)
- A Heatmap cell (`cellAsk`) → "What landed on `<weekday>` around `<hour>`?" (template `merged-recent` with a filter)
- An Insight source chip (`sources[].ask`) → "Show me the `<n>` open PRs" (template `stale-issues` shape, kind: pull)

That is 12 golden templates plus 3 follow-up templates (`check-failures`, `pr-detail`, `person`), 15 total. The classifier picks one of 15 or says `off-template`.

## Off-template

When the classifier returns `off-template`, Sonnet composes freely from the registry with the same data context. Expected for perhaps 10% of live questions. The eval set includes 10 off-template questions to measure quality there.

## Questions the app cannot answer, and what it says

- Private repo: "That repo is private or doesn't exist" in the field's validation line. Never a composed screen.
- Traffic (views, clones): the classifier maps to `off-template` and the composer answers with an Insight saying traffic needs push access, plus the overview template. The eval set has one of these.
- A per-person question when the punch card is repo-wide: the Heatmap is titled "When commits land" and the Insight says the hours are for the whole repo. Decision 45.
