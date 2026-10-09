# Decisions

Every settled question, stated as a constraint. Read this before asking the owner anything. Numbers in parentheses refer to the design system's decision log (`design-system/decisions.md`, section "Open for the audit"), where the reasoning lives.

## Product

- Name: Generative UI for GitHub Repos. Slug `generative-ui-github`. npm scope `@genui-github`.
- Public repos only. No OAuth, no private repos, no user accounts. The only visitor state is a `localStorage` last-repo convenience and a day-scoped rate-limit counter keyed on a SHA-256 of IP plus user agent, kept in KV and gone at midnight UTC. No question text, repo name or result is ever stored per visitor.
- Sample repos: `vercel/next.js`, `facebook/react`, `anthropics/claude-code`, `tailwindlabs/tailwindcss`, `vitejs/vite`. Precomputed and cached forever; refreshed by script.
- No persona toggle. The composer picks a default density from the question ("quick version" → compact; "walk me through" → spacious; else comfortable). The tray has a segmented density control the reader can override with; the override persists for the session.
- No chatbot. Help is the "how this works" overlay plus the question field itself.
- The footer is the whole privacy policy: "Nothing you paste is stored. Public repos only. Sample data is marked."
- Everything in the plan is v1. Nothing is deferred.

## Stack

- pnpm + Turborepo monorepo. Next.js App Router. React. TypeScript strict. CSS modules + custom properties. Motion (Framer) for wrappers, GSAP for internals. Zod for schemas. Vercel AI SDK is not used; the Anthropic SDK is called directly so cost accounting and caching are explicit. Octokit for GitHub. Vitest. Vercel hosting. Optional Vercel KV behind a cache interface.
- No Tailwind. No Storybook; the catalog page is the component documentation.
- Node 22.12+ (the Vitest 5 floor; Node 20 reached end of life in April 2026). Develop on 22 or 24 LTS. ESM throughout.

## Protocol

- Own internal UI description format (`packages/renderer/src/format.ts`): a tree with stable ids, regions, and `ask` on clickable pieces. A2UI adapter both ways for the README claim. The internal format is the source of truth; A2UI is an export.
- MCP App: MCP Apps 2026-01-26 (SEP-1865, extension `io.modelcontextprotocol/ui`), read from `modelcontextprotocol/ext-apps/specification/2026-01-26/apps.mdx` on 2026-10-09. SDK `@modelcontextprotocol/ext-apps` 2.0.3 with `@modelcontextprotocol/server` 2.3. One model-visible tool, `compose(repo, question)`, with `_meta.ui.resourceUri` `ui://genui-github/compose.html`; an app-only tool `compose-check` for the warming re-checks; the composition travels in `structuredContent`, the insight sentence and the full-screen link in `content`.
- Streaming is JSONL with six ops: `start`, `add`, `update`, `remove`, `done`, `error`, as `docs/schemas.md` defines them.

## Model routing

- Haiku classifies the question to one of 15 templates or `off-template` and fills the prose slots of a template. Sonnet composes only off-template. The registry block is cached. No open model in v1 evals.
- Model ids: Haiku is Haiku 5.5, `claude-haiku-5-5` (owner, 2026-10-08, replacing Haiku 4.5: a tenth of the price, built for classification and routing). Sonnet is Sonnet 5.5, `claude-sonnet-5-5`. Both live in `packages/core/src/models.ts`. Haiku 5.5 runs adaptive thinking with effort defaulting to `medium`; the classifier and the fill set effort explicitly (start at `low` for the ~300ms classify budget) and Phase 5 tunes it against the eval set. Haiku 5.5 prices by prompt length: over 100,000 prompt tokens every token costs five times more, which the price table models; our prompts stay far below it. Prices: read the per-million input, cached-input and output prices for both models from https://docs.claude.com/en/docs/about-claude/pricing at Phase 0, write them into the price table with that date, and update the table whenever prices change. Never hard-code a price anywhere else.
- The Motion package is `motion` (the current name of Framer Motion), imported as `motion/react`.
- Evals call the composer directly, never the route, so the visitor limit and the daily cap do not apply to them. One full eval run (99 cases × 3 models × 3 runs) is roughly 900 compositions; budget about $15 at current prices and confirm with the cost accounting after the first run.
- Vercel KV is required in production because the per-visitor limit and the daily cap are counters that must survive serverless cold starts. In-memory counters are for dev only. The cache uses the same KV when present.
- ActionCard is sample mode only in v1: it drafts and shows, never writes to GitHub. The live rows in its README are not built. There is no `ACTION_MODE` variable.
- 15 live composer calls per visitor per day. Golden questions on sample repos never call a model: the 60 golden compositions (12 questions × 5 samples) are precomputed once by `pnpm compositions:refresh` and committed under `packages/composer/golden/`; the route serves them from there. Global daily cap from `DAILY_CAP_USD` (owner sets it; start at 5) flips the site to cached-only mode, which says so in the tray.

## Data

- Server-side fine-grained token, public repos read-only. Never in the client.
- 15-minute cache per live repo. Stats cache keyed with the default-branch SHA. Samples never expire.
- `/stats/*` 202 is warming, with the backoff in `docs/data-layer.md`. Every stats-reading shape carries `cachedAt` (14) so WarmingUp's stopped state can cite a copy.
- Time zone: the viewer's for Timeline days and Heatmap hours (22).
- ContributorRank window is fixed at 90 days; Heatmap offers 4, 12 or 52 weeks; the repo-wide punch card is titled "When commits land" and never claims to be per person (45).
- Bots excluded from first-response metrics. A merge counts as a first response.
- Changed after the real calls of task 4.5 (2026-10-09), details in `docs/data-layer.md`:
  - Run timing comes from `/actions/runs/{id}/jobs`; `/timing` has no job or step durations on a public repo.
  - "CI" is one workflow, the one with the most push runs on the default branch, read a whole week at a time for 12 weeks. A sample of every workflow's latest runs is mostly automation.
  - A run updated in bulk (3 or more ending in the same second) or longer than a day carries no duration.
  - Exact counts (open, awaiting review, stale, merged per week and month) come from GitHub search, one query, 1 point. The lists stay capped samples, and a figure from a list says where its data starts.
  - Bots also include plain accounts ending in `-bot` or `_bot`.
  - Core vs community share is read from who authored the merged pull requests (OWNER, MEMBER, COLLABORATOR are core), because `participation.owner` is near zero for an organization's repo.
  - An undated milestone is not a release: with no dated milestone, the blocking list is the open ready pull requests by wait.

## Components, settled from the design audit

- Every chart has a table view, as a control in the card header, built in Phase 2 (15).
- Numbers the model writes in prose are validated against the cited data; a miss renders the system sentence (18).
- One row hover across the system: `surface-tint`, `radius-md`, inset `space-2`, neighboring hairlines hidden, no shadow (`design-system/decisions.md`, System).

- Small radii: add `radius-xs` 4px to the tokens for bar ends, heatmap keys and chart keys (1). No raw numbers.
- Type styles added to tokens: `handle` (mono 13px 500), `value` (sans 13.5px 600), `hint` (sans 12.5px), `section` (sans 19px 600) (2). Comparison's delta stays 700; Timeline's day heading stays 500; Steps' 21px title line stands (3, 21, 35).
- `--control-h` 36/40/44 drives fields, chips and buttons (4). Button scales with density.
- Text actions pad their hit area to 36px everywhere via `TextLink` (5).
- `word-spacing: .06em` on sans under 13px (6).
- Timeline's `node` and `endpoint` are named marks in the shared `Mark` part (7). Timeline and Steps share one spine implementation (8).
- `surface-tint` keeps its five jobs (9). Hover motion: buttons lift, rows tint, nothing else moves (10).
- Interaction-speed motion tier in `motion.md` (11). Chip stagger is 70ms everywhere; LineChart half width is 632px (12).
- The warming mark means "waiting on GitHub"; ActionCard's working state reuses it (13).
- Resting field and chip borders stay `line`; under `prefers-contrast: more` they become `muted` (16). Faint `line` structure stays (17).
- Metric + Sparkline: one width per row, set by the region (19). Timeline keeps its warming state (20).
- LineChart y axis is zero-based (23). Distribution median at bin center (24), perspective `reader` by default, `neutral` when the question is about the repo (25). Chart gutters: widest tick plus `space-2` (26). Comparison tally always on, errors card-level (27).
- ContributorRank row 1 fills its track (top share) (28); wording "at risk" in ink (29). Heatmap peak is the white dot, cells fluid (30).
- ActionCard result row shrinks (31); "Confirm", live question under "sample", identifiers 500 (32). Two input error kinds: invalid is crit, unreachable is neutral (33). Hero field `radius-lg`, Select option `radius-sm`, menu `card` shadow stay (34).
- WarmingUp copy as written; schedule 0 to 120s with the backoff; tune on real repos in phase 4 (36). DiffView `lead` prop held until eval evidence (37). Fold at 40, stop at 1,000, FileTree opens all at 20 or fewer (38). Word highlights as `<mark>` (39). FileTree's 3,000-file cap and phone layout built in phase 2 (40).

## Screens, settled

- Height classes per component: `fixed`, `grows`, `plot`; the composer pairs like with like and a template may declare a `.stack` for a third card in the shorter cell (41).
- StatusList `kind`: `pull`, `issue`, `workflow`, `check`, each with its own state enum and a `value` slot (42).
- Narrow rules move into each component: Comparison name on its own line, Heatmap scrolling field with sticky day labels, Distribution narrow form, Steps fact under the title, Sparkline row trend, long titles wrap. StatusList uses the wrap rule everywhere (43).
- Spacious steps down one density under 640px (44).
- Composer rules in code: no metric repeats a band's words; no Steps `ask` recomposes a list on screen (46).
- DiffView: soft wrap by default, scroll for indentation-significant files (YAML, Python, Makefile) (47).
- Identifiers in card titles stay sans (48).
- Promoted to tokens: `scrim` (ink 10%), `sheet` shadow, a `lead` type style for WarmingUp and RateLimit (49). The mono repo chip and the segmented control are shell components in `packages/ui/src/parts/`, not tokens.
- Schema additions: Timeline commits (`id` PR number or short SHA, `verb`); a Metric with `format: "clock"` wipes in instead of counting; escalation reasons have fixed wording in `docs/composer.md` (50).
- Rate limit: Try again is enabled and re-checks for free; the tray is disabled with the reset time; DailyCap shows the original built figure (51).
- Landing: the chips are the twelve golden questions from `docs/golden-questions.md`, grouped Shipping, Health, People, Getting started; the screen mock's chip wording is superseded. One sample repo preselected with the accent mark; "Who should review this PR?" is not a chip; `@supports` fallback for the preview scale; page behind the overlay is `inert` (52).
- MCP App frame: 420px design width, 360px floor, container queries, the composer is told the frame width (53).
- Catalog: a disabled segment for skipped states; View JSON shows the sample; Evals scroll box is not a tab stop on desktop (54). Built figure stays tabular (55). Ask key hints dropped (56).
- Arrival order with a warming card on a composed screen: the warming card takes its region's slot at full height with the WarmingUp row; when data lands it morphs in place (57).

## Ownership

- The npm scope `@genui-github` must be claimed by the owner on npmjs.com before 10.2. If it is taken, the fallback is `@brandonchurch/genui-*`; the executor notes which in `docs/questions.md`.

## Testing depth

Lean. One render test per component per state against `sample.json`. Schema validation tests for every composer output. Composition-rule tests that reject violating trees. Diff-engine unit tests. Data-layer fixture tests. The eval harness is the real quality gate. No CSS unit tests, no snapshot tests of markup, no duplicate cases.

## Commits

Local commits at the end of each task group, conventional messages, no push, no secrets. The owner pushes.
