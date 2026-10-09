# Schemas

The contracts between the composer and the renderer. This file is authoritative for prop names, enums and limits; each component's README under `design-system/components/` is authoritative for behavior and appearance. Where a README names a prop differently, this file wins and the README is read for what the prop does.

The model names things; the system binds them. The model sends a measure id, a data key, a handle or a window, and the system looks up the numbers, computes shares and bins, writes tag words and verdicts, and renders. The model writes prose only in the slots marked `prose`, and every number in prose is validated against the data it cites.

## The UI description

```ts
type Composition = {
  id: string                       // one per question; a rewrite gets a new id
  density: Density                 // the composer's default; the tray can override it
  regions: {
    insight: Piece[]               // exactly one Insight, or a system sentence
    metrics: Piece[]               // 0 to 4 Metric
    main: Piece[]                  // the primary card(s); a second grows piece stacks below the first
    side: Piece[]                  // secondary card(s)
    action: Piece[]                // 0 or 1 ActionCard
  }
  asks: Ask[]                      // follow-up chips, 0 to 4, { label, ask }
  built: Built                     // written by the system, never the model
}

type Piece = {
  id: string                       // derived by the system from component + data key; stable across rewrites
  component: ComponentName
  props: unknown                   // validated against that component's schema
  ask?: string                     // the question a click on the whole piece asks
  emphasis?: Emphasis
  tone?: Tone
}

type Built = {
  template: string | 'off-template'
  reason?: 'no template matched' | 'change point found' | 'follow-up with no template'
  model: string
  tokens: { input: number; cached: number; output: number }
  costUsd: number
  latencyMs: { classify: number; data: number; compose: number; render?: number; total: number }
  githubReads: number
  chose: string[]
}
```

Streaming, one JSON object per line:

```ts
| { op: 'start'; id: string; density: Density; asks: Ask[] }
| { op: 'add'; region: RegionName; piece: Piece }
| { op: 'update'; id: string; props: unknown }
| { op: 'remove'; id: string }
| { op: 'done'; built: Built }
| { op: 'error'; reason: string }   // the composition failed; the renderer shows the system error sentence
```

## Shared enums and types

```ts
Density  = 'compact' | 'comfortable' | 'spacious'
Tone     = 'neutral' | 'good' | 'warn' | 'crit'
Emphasis = 'low' | 'medium' | 'high'
EmptyTone = 'neutral' | 'good'
HeightClass = 'fixed' | 'grows' | 'plot'
Window   = '7d' | '14d' | '30d' | '90d' | '4w' | '12w' | '52w' | 'week' | 'month' | 'milestone'
Ask      = { label: string; ask: string }
Link     = { label: string; href: string } | { label: string; ask: string }
```

## Measure catalog

Measures are ids the data layer computes for any repo and window. Metric, Comparison and Sparkline reference them; the model never sends the numbers. Each measure has a unit, a direction (which way is better) and a formatter. Defined in `packages/data/src/measures.ts`; the registry prompt lists them.

| id | unit | better | what |
| --- | --- | --- | --- |
| `open-prs` | count | neutral | open pull requests, optionally on a milestone |
| `awaiting-review` | count | lower | open PRs with no review decision |
| `changes-requested` | count | lower | open PRs with changes requested |
| `failing-checks` | count of total | lower | failing check runs on the default branch head |
| `milestone-issues-open` | count of total | lower | open issues on the next milestone |
| `prs-merged` | count | higher | merged in the window |
| `review-wait-median` | h | lower | time to first human review, median |
| `review-wait-p90` | h | lower | same, p90 |
| `time-to-close-median` | d | lower | issues and PRs opened to closed |
| `closure-ratio` | ratio | higher | closed ÷ opened in the window |
| `ci-p50` | min | lower | workflow run duration p50 on the default branch |
| `ci-p90` | min | lower | same, p90 |
| `failing-check-rate` | percent | lower | failed runs ÷ runs |
| `flaky-rate` | percent | lower | runs that passed on rerun ÷ runs |
| `slowest-job` | min | lower | the slowest job in the slowest run |
| `failing-since` | runs | lower | consecutive runs the current failure has persisted |
| `pr-size` | count | neutral | lines changed in a PR (additions plus deletions) |
| `contributors` | count | higher | distinct human authors in the window |
| `first-time-contributors` | count | higher | authors with their first merge in the window |
| `bus-factor` | count | higher | smallest n making 50% of commits |
| `core-share` | percent | neutral | owner-org commits ÷ all |
| `community-share` | percent | neutral | non-owner-org commits ÷ all |
| `stale-issues` | count | lower | open issues with no activity for 30 days |
| `good-first-issues` | count | neutral | open issues labeled good first issue or help wanted |
| `stars` | count | higher | stargazers |
| `commits` | count | neutral | commits in the window |
| `files-changed` | count | neutral | in a PR or between two tags |
| `busiest-hour` | clock | neutral | the punch card's peak hour |
| `quietest-day` | text | neutral | the punch card's lowest weekday |
| `milestone-closes` | clock | neutral | the next milestone's due date |

A Metric with a `clock` or `text` unit wipes in instead of counting.

## Stable ids

The system derives `id` = `${component}:${key}` where `key` is the measure id, the list's kind and scope, the chart's measure, or the rank's measure and window: `metric:failing-checks`, `statuslist:pull:milestone-v16.2`, `linechart:ci-p50`, `rank:commits:90d`. Two compositions that both show failing checks produce the same id, so the diff engine morphs instead of remounting.

## Components the model may pick

Fields marked `prose` are the only places the model writes sentences. Fields marked `(system)` are not in the model-facing schema.

### Insight · `fixed`
- `sentence` prose, max 120 chars, backticks mark identifiers. Every number must appear in the cited sources.
- `sources` `{ key: string; ask?: string }[]`, 1 to 4: data keys or measure ids the sentence rests on. The system renders the source line; a source with `ask` is a chip.
- `tone` Tone.
- when: "The one sentence that answers the question. Always first. Every number must come from the data."
- Omitted states: none. Warming and error are system sentences in the same slot.

### Metric · `fixed`
- `measure` measure id.
- `label` string, sentence case, max 28 chars (the model's words; defaults to the measure's label).
- `window` Window optional.
- `scope` string optional: a milestone, branch or PR number the measure is scoped to.
- `delta` prose optional, max 32 chars, validated. `deltaTone` Tone.
- `hot` boolean; at most two per composition.
- `trend` boolean: render the measure's 12-week series as a Sparkline beside the number.
- `ask` on the piece.
- `value`, `suffix`, `format` (system, from the measure).
- when: "One number that answers part of the question. Hot means it is blocking."

### Sparkline · part of Metric, never pickable
- `points` 12 weekly values and `finding` for the aria-label, both from the measure (system).

### StatusList · `grows`
- `kind` `'pull' | 'issue' | 'workflow' | 'check'`.
- `title` string; `meta` string optional ("sorted by wait").
- `scope` `{ milestone?: string; branch?: string; pr?: number; labels?: string[]; author?: string; window?: Window }`: which items. The system fetches and sorts them.
- `sort` `'wait' | 'age' | 'activity' | 'size' | 'duration'`.
- `limit` 3 to 8.
- `emptyTone` EmptyTone; `empty` prose, max 60.
- `items` (system): each `{ id, title, meta, state, value?, trend?, ask? }`; `state` per kind, mapped to tag words by the system:
  - pull: `pending | changes | failing | approved | draft`
  - issue: `open | stale | good-first | assigned | closed`
  - workflow: `passing | failing | flaky | queued | disabled`
  - check: `passed | failed | timeout | running | skipped`
  - `value`: `{ add, del }` for pull · `{ comments }` for issue · `{ p50Min, failRate }` for workflow · `{ durationMin }` for check; `trend` optional 12 points for workflow rows.
- when: "A titled list of things with a state each. Pick the kind that matches the data."
- Row is a part, not pickable.

### Timeline · `grows`
- `title`; `meta` optional.
- `kind` `'merged' | 'commits'`: merged PRs on a scope, or commits between two refs.
- `scope` `{ milestone?: string; branch?: string; base?: string; head?: string; author?: string; window?: Window }`.
- `limit` 3 to 8; for more the composer narrows the window.
- `emptyTone`, `empty` prose.
- `dayAsk` string optional, a pattern with `{day}` the system fills for a click on a day heading.
- `items` (system): `{ id, title, author, when, add?, del?, verb?, url, ask? }`, newest first, grouped by day in the viewer's zone; the newest gets the accent endpoint.
- when: "Things that happened in order, grouped by day."

### LineChart · `plot`
- `title`; `meta` (the statistic and the window).
- `series` 1 or 2 of `{ measure: measure id; name: string; scope?: object }`; the first is the story. Weekly points come from the data layer.
- `failures` boolean: render failed runs per week as the strip under the plot. Never a second axis.
- `window` `'12w' | '26w' | '52w'`.
- `finding` prose, max 120 chars, validated; used as the aria-label.
- `emptyTone`, `empty` prose.
- when: "A quantity over time, one or two series. Failure counts go in the strip, not a series."

### Distribution · `plot`
- `title`; `meta` (the window).
- `measure` `'firstReview' | 'merge' | 'issueResponse'`.
- `population` `'firstTime' | 'all'`.
- `perspective` `'reader' | 'neutral'`.
- `showP90` boolean, default true.
- `emptyTone`, `empty` prose.
- The system computes bins, median, p90, labels and the source line.
- when: "How long something takes here, as a spread. Reader perspective for newcomer questions."

### Comparison · `fixed`
- `title`; `window` `'week' | 'month' | '30d' | 'milestone'`.
- `pairs` 2 to 4 of `{ measure: measure id; direction: 'lower-is-better' | 'higher-is-better' | 'neutral'; notable?: boolean; ask?: string }`.
- `finding` prose, max 90, for the aria-label.
- `emptyTone`.
- The system reads both windows, computes deltas, signs, verdict words and the tally.
- when: "This period against the last one, two to four measures."

### ContributorRank · `grows`
- `title`; `meta` optional.
- `measure` `'commits' | 'reviews'`.
- `limit` 3 to 8.
- `wallTone` `'fact' | 'risk'`.
- `emptyTone`, `empty` prose.
- The window is 90 days, set by the data layer. The system fetches people, sorts, computes shares, finds the wall, writes the band.
- when: "Who does the work and how concentrated it is. Shows bus factor."

### Heatmap · `plot`
- `title`.
- `unit` `'commits' | 'reviews' | 'merges' | 'comments'`.
- `window` `'4w' | '12w' | '52w'`.
- `summary` prose, max 120, the aria-label.
- `cellAsk` string optional, a pattern with `{weekday}` and `{hour}`.
- `emptyTone`, `empty` prose.
- The data layer fills 7 × 24 in the viewer's zone, Monday first (index 0 = Monday). Repo wide, never per person.
- Table view control in the header (system).
- when: "When things happen by weekday and hour. Repo wide."

### ActionCard · `fixed`
- `heading` prose, verb first, max 48. `body` prose, max 140, what happens and what does not.
- `primary` string, verb first.
- `secondary` Link optional.
- `effect` `{ kind: 'comment' | 'request-review' | 'add-label' | 'rerun-checks'; targets: string[] }`. Nothing that merges, closes or deletes exists.
- `mode` (system) is `sample` in v1. The confirm question, confirm line, working count and result are written by the system from `effect`.
- when: "One small, undoable next step on data already on screen. At most one, always last. Leave it out when there is nothing worth doing."
- Omitted states: empty (leave the card out), warming (reads no stats).

### Steps · `grows`
- `title`; `meta` optional.
- `steps` 2 to 6 of `{ id, title (imperative, max 40), body (prose, max 140), fact? (max 24, copied from data, never estimated), link?: Link }`.
- when: "A sequence the reader walks in order. Fewer than two steps is an Insight."

### Form · `fixed`
- `title`; `meta` optional (the current scope).
- `fields` 1 to 4 of TextInput | Select | FilterChips specs (below), in order.
- `submit` string (verb phrase); `secondary` `'Reset' | 'Cancel'` optional; `effect` string ("replaces this screen").
- when: "The next step needs input the screen can't guess: change scope, compare windows, pick a branch."
- Omitted states: warming (an input never waits on a 202), empty.

### TextInput · field only
- `label`; `placeholder?`; `helper?`; `kind` `'text' | 'identifier'`; `validate` `'repo' | 'branch' | 'handle' | 'none'`; `required` default true.

### Select · field only
- `label`; `options` `{ value, label, meta? }[]` from data already fetched; `value`; `placeholder?`; `helper?`; `required?`.
- Omitted states: skeleton, empty, warming (options arrive with the schema; no options renders disabled with the reason in the helper).

### FilterChips · field, or standalone above its target `fixed`
- `target` the id of the component it filters; `mode` `'single' | 'multi'`; `options` `{ value, label }[]`; `selected`; `label` only inside a Form.
- Counts are computed by the system from the target's data.

### DiffView · `grows`
- `repo`; `pr` number; `path` one of the PR's files.
- `open` boolean default true; `lead` hunk index optional; `emptyTone`.
- The system fetches the patch, folds at 40 lines, stops at 1,000, highlights words on equal-length paired runs, wraps or scrolls by file kind.
- when: "The change itself, one file. For a question about one pull request."

### FileTree · `grows`
- `repo`; `mode` `'changes' | 'overview'`; `pr` for changes, `path` for an overview root.
- `title`; `selected?`; `open?` string[] of folders; `emptyTone`.
- The system orders, compresses chains, truncates, counts, caps at 3,000 files.
- when: "Which areas a change touches, or how a folder is laid out."

### WarmingUp · system only
- Driven by `WarmingStatus` (below). The composer never picks it. When the data context reports warming, the shell renders the system sentence in the insight region, the WarmingUp lanes card in `main`, and leaves the other regions empty; when stats land, the composition takes over by wipe.

### Code-first primitives (pickable)
- `Checklist` `fixed`: `title`; `source` `'community-standards' | 'milestone' | 'release-checklist'`; the system fills items and the health ring. when: "A set of yes/no checks, like community standards."
- `BarChart` `plot`: `title`; `meta`; `measure` a measure id with a `by` of `'workflow' | 'label' | 'author' | 'area'`; max 12 bars; `finding` prose. when: "One measure across a handful of categories."
- `ActivityFeed` `grows`: `scope`; `limit` 3 to 10; the system fills `{ actor, verb, object, when }`. when: "A stream of recent events with actors."
- `PersonList` `grows`: `measure` `'commits' | 'reviews' | 'issues'`; `limit` 3 to 8; the system fills handles and one fact each. when: "A short list of people with one fact each."
- `KeyValue` `fixed`: `source` `'repo' | 'pr' | 'release'` with a `scope`; max 8 pairs filled by the system. when: "A few labeled facts about one thing."
- `Callout` `fixed`: `tone`; `text` prose max 160. when: "One sentence the reader must not miss. Rare."
- `CodeBlock` `grows`: `repo`; `path`; `lines?` `[start, end]`; `caption?`. when: "A snippet from the repo."
- `Progress` `fixed`: `measure` a count-of-total measure; `label`. when: "Part of a whole, like milestone completion."
- `EmptyState` `fixed`: used by the system when a region has nothing; not in the prompt.

### Layout primitives (registered, `pickable: false`, excluded from the prompt)
Surface, Section, Stack, Grid, SplitView, Drawer, Tabs, Heading, Text, List, Avatar, Button, Ask. Templates and the shell use them.

## WarmingStatus

One type, used by the data layer, the shell and the WarmingUp component:

```ts
type WarmingStatus = {
  repo: string
  phase: 'warming' | 'stopped'
  attempt: number
  nextCheckMs: number
  startedAt: string                // ISO
  elapsedMs: number
  stats: {                         // in reading order
    id: 'contributors' | 'participation' | 'commit_activity' | 'punch_card' | 'code_frequency'
    state: 'counting' | 'ready' | 'cached' | 'missing'
    landedAt?: string
    cachedAt?: string
  }[]
}
```

## Registry prompt

`registry.toPrompt()` renders, in this order: the measure catalog (id, unit, better, one line each); then per pickable component: name · height class · the `when` line · the JSON Schema of the model-facing props (system fields stripped) · one minimal example. Target under 7,000 tokens; measured with the Anthropic token-count endpoint in a test. Cached as one block.

## Validation pipeline (renderer and composer share it)

1. Parse the JSONL message. Malformed → log, skip.
2. `component` in the registry and pickable? No → an error piece ("Unknown component") and a log line.
3. Props validate against the schema? No → error piece, first Zod issue logged.
4. Measure ids and data keys exist in the data context? No → error piece.
5. Composition rules (`docs/composer.md`): a violating piece is dropped with a logged reason.
6. Number validation: every number in a `prose` field must appear, within rounding, in the data the piece cites (`sources`, its measure, its series). A miss replaces the prose with the system sentence.
7. Derive `id`; attach `ask` handlers.
