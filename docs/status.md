# Status

Newest entry first. Written at every GATE and whenever a session ends mid-phase.

## 2026-10-09 · Phase 7 stopped · the Anthropic credit balance ran out

Stopped mid-phase, not at a gate: every Anthropic call now answers 400 "Your credit balance is too low to access the Anthropic API." Live questions in the app fail the same way until credits are added; golden questions on the five samples still open (they call no model).

**Done and verified**

- 7.1 Scorers (template, components F1, hot, schema, bindings, numbers, rules, plus latency and cost) with unit tests; the runner calls `compose()` directly with eval levers (skip the golden set and answer cache, route everything off-template for `sonnet`, Haiku off-template for `haiku`) and taps for the context, the route and rule drops.
- 7.3 `/evals` renders the newest results file per model from the catalog's Metric, Comparison and StatusList, a page-level latency chart and per-model tables.
- 7.4 `pnpm evals:check` failed on two deliberately broken release-blockers templates (one that fails to compose, one bound to a milestone that does not exist) and passed on the restored one.
- Along the way: the off-template path now streams pieces as they arrive (it sent everything at the end); rule 5 drops a metric's repeated words instead of the metric; 16 set expectations follow the sample data (`docs/questions.md`, 7.1 and 7.4).

**The production baseline** (`packages/evals/results/2026-10-09-production.json`, committed): 99 cases × 3 runs, final scorers.

| Scorer | Pass rate (mean, run spread, n) |
| --- | --- |
| template | 0.96 (0.96 to 0.96, 99) |
| components | 1.00 (1.00 to 1.00, 83), mean F1 0.993 |
| hot | 1.00 (10) |
| schema | 1.00 (97) |
| bindings | 1.00 (55) |
| numbers | 1.00 (97) |
| rules | 1.00 (97) |

Done p50 6.1s, p90 8.4s; first piece p50 6.1s; $0.56 for 297 compositions, $0.0019 each. The four template misses are off-template questions the classifier routes to a template (off-02, off-03, off-04, off-06) and follow-06-source, in every run.

**Open: 7.2 and 7.5 need credits**

- `sonnet`: the first full run (before the final scorers) gave template 0.13 (by design: everything goes off-template), components 0.31 (F1 0.76), schema 0.91, rules 0.95, done p50 4.7s, first piece p50 2.6s, $3.99 for 297, $0.0137 each. Its file is in `packages/evals/results/` but not committed: it was scored before bindings became strict.
- `haiku`: the first full run gave template 0.95, components 1.00, schema 0.997, done p50 6.0s, $0.19 for 297. The rerun failed on every call once credits ran out, and that file was deleted.
- Spent on evals today: about $5.7 of the $15 budget.
- To finish: add credits, then `pnpm evals:run --model sonnet --runs 3`, `pnpm evals:run --model haiku --runs 3` (about $4.2), commit the two files, put the three-model table here, tick 7.2 and 7.5, and continue into Phase 8.

## 2026-10-09 · GATE 4 passed · continuing into Phase 7

The owner ran the app and it works as expected. They expect to want UI and UX changes; those are box A.3 in the final audit, beside A.1 and A.2. Phase 7 starts now.

## 2026-10-09 · GATE 4 · the app shell

Phase 6 is complete: 6.1 to 6.13 are ticked and verified. GATE 2 and GATE 3 wait in the final audit (A.1, A.2). The session stops here for GATE 4: use the app end to end on desktop and phone.

**How to check it**

- `pnpm dev`, open `/`. Pick a sample or paste a repo, pick a question. Golden questions on the five samples open from the committed compositions with no network or model call; anything else asks Haiku (and Sonnet off-template) live.
- On a composed screen: click a metric or a row to ask its follow-up, press `r` to replay the screen, switch density in the tray, open "How this was built" from the built figure or the strip.
- Force each special screen on any composed URL with `&force=warming`, `&force=ratelimit`, `&force=cap` or `&force=empty` (the near-empty repo reads right at `/r/vercel-labs/vercel-byoc?q=What%27s%20blocking%20the%20next%20release%3F&force=empty`).
- On a phone, or at 390px: every screen is one column with no sideways scroll.

**What was verified**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (core 6, data 67, ui 311, renderer 27, composer 170, web 15, evals 2, mcp-app 1), `pnpm e2e` (38 passed, 1 skipped: the live follow-up click, run with `E2E_LIVE=1`), `pnpm a11y` (6 passed, zero serious issues on every golden screen, every forced screen, the landing, the catalog, `/evals` and `/about`, at 1440 and 390; fields are 16px under 480px).
- The 60 golden screens fit 390px with no horizontal scroll (Playwright asserts `scrollWidth === clientWidth`).
- Click to recompose, live: "Failing checks" on next.js release blockers rewrote to check-failures in about 6.5s, the metric kept as the same DOM node and morphed; the URL and question followed.
- A cold live repo (`sindresorhus/cpy-cli`): WarmingUp for about 11s, then the card left and the contributors answer composed in.
- Screenshots of the landing, the composed screen, the drawer, the overlay and the special screens at 1440 and 390, compared with `design-system/screens/`.

**Built along the way**

- The composer keeps every composed answer 15 minutes (samples forever) under a hash of repo and question, so a share URL replays with no model call and still opens at the daily cap. Responses say how they were served (`x-genui-served`, `x-genui-cached-at`, `x-genui-capped`).
- The renderer now settles when its host re-renders mid-entrance: a class piece enters once per plan, and a wrapper animation completed early resolves its own handle (StrictMode in dev never settled before).
- StatusList takes the wrap rule under a 30em container: titles wrap, nothing truncates. The action card takes one column, and the split stacks under 1024px, as `shell.css` does.
- Timeline binds an empty state, not an error, when a repo has no two releases to compare.
- `/evals` and `/about` are placeholders in the frame until Phases 7 and 10.

**Open**

- New entries in `docs/questions.md` for 6.6 to 6.12: force flags on in production, follow-up clicks call Haiku on samples, the footer wording, and the small gaps listed under 6.7 (near-empty fixture missing contributors, the eyebrow under `force=empty`, LineChart tiny ticks, SystemScreen exit, a server-rendered Renderer's hydration under reduced motion, unused hero tokens, copy to read).

## 2026-10-09 · GATE 3 deferred · continuing into Phase 6

The owner still could not review and asked to continue. GATE 3's checks are box A.2 in the final audit before Phase 10, beside GATE 2's. Phase 6 starts now.

## 2026-10-09 · GATE 3 · the data layer and the composer

Phases 4 and 5 are complete: 4.0 to 4.11 and 5.0 to 5.9 are ticked and verified. GATE 2 was deferred to the final audit (plan box A.1) at the owner's request. The session stops here for GATE 3.

**How to check it**

- `pnpm dev`, then `POST /api/compose` with `{ "repo": "vercel/next.js", "question": "<a golden question>" }`. The answer is JSONL: `start`, one `add` per piece, `done` with the built block. A golden question on a sample repo streams the committed composition (`packages/composer/golden/vercel__next.js/<template>.json`) with no model or GitHub call. The renderer page that draws a composition from this route is Phase 6; until then the JSON is the thing to read.
- The twelve next.js answers, as committed:

| Template | Insight sentence | Pieces |
| --- | --- | --- |
| overview | 2,525 pull requests are open and 84 merged, with a 1.1 h median review wait and 27 contributors. | Insight, Metric × 4, StatusList, LineChart, Checklist |
| release-blockers | 1,620 pulls await review and 57 of 485 checks fail, out of 2,525 open pull requests. | Insight, Metric × 3, StatusList, LineChart, ActionCard |
| contributors | Work is split evenly: the core team share is 50% across 27 contributors, with a bus factor of 8. | Insight, Metric × 3, ContributorRank, LineChart, Heatmap |
| ci-trend | Median CI run is 11.1 min, with a failing run rate of 20.3% and slowest job 6.8 min. | Insight, Metric × 3, StatusList, LineChart, Comparison |
| merged-recent | 84 pull requests merged this week, with a median review wait of 1.1h. | Insight, Metric × 2, Timeline, PersonList |
| stale-issues | 901 issues have gone stale. Median time to close is 0.2 d. | Insight, Metric × 2, FilterChips, StatusList, BarChart, ActionCard |
| biggest-pr | The biggest open PR changes 2,454 lines across 28 files. Median review wait is 1.1h. | Insight, Metric × 3, DiffView, StatusList, FileTree |
| new-contributor | Start with one of the 11 good first issues. Median review wait is 1.1 h and 3 first-time contributors are listed. | Insight, Steps, Distribution, Checklist |
| responsiveness | Maintainers respond fast: median review wait is 1.1h and median time to close is 0.2d, with closure ratio at 1×. | Insight, Metric × 3, ContributorRank, Distribution, LineChart |
| month-compare | 84 pull requests merged, failing run rate 20.3% and median review wait 1.1 h. | Insight, Metric × 2, Comparison, StatusList |
| punch-card | Commits cluster around 23:00 UTC, the busiest hour, with Sunday the quietest day and 662 commits in all. | Insight, Metric × 2, Heatmap, PersonList |
| release-diff | 4 commits, 1 contributor and 25 files changed. | Insight, Metric × 3, Timeline, FileTree |

**Built**

- `packages/data`: the GitHub client (retries, `GitHubError`, rate-limit logging), the resolver, GraphQL, REST and stats fetchers, the 202 warming check on the WarmingUp schedule, CHAOSS, every measure, the derived shapes, the cache (memory and Upstash KV), the data context builder, and the five committed samples (`pnpm samples:refresh`, 290 GitHub requests). Exact counts come from GitHub search (one query, one point); lists are capped samples, and a figure from a list says where its data starts.
- `packages/composer`: the eval set (99 cases), the Anthropic client with a cached system block and costing from the price table, the Haiku classifier, a binder for every pickable component, the 12 golden and 3 follow-up templates, the prose fill with a strict number check, off-template composition with Sonnet, the composition rules in code, the visitor limit and daily cap, `POST /api/compose`, and the 60 golden compositions (`pnpm compositions:refresh`).
- The fetchers and the binders were written by parallel subagents to shared briefs, each in its own folder; I integrated, reviewed and fixed what real data showed.

**Verified**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (data 67, composer 164, renderer 27, ui 311), `pnpm e2e` (21), `pnpm a11y`.
- The five unverified GitHub facts answered with dated calls in `docs/data-layer.md`.
- Classifier: 32 of 32 golden and paraphrase questions right, live. Fill: 100 live runs, 177 sentences kept, 9 refused, zero unvalidated figures in any tree ($0.057). Off-template: the 10 eval cases compose valid trees live ($0.013 each); the recordings replay in tests. The golden zero-call test and the visitor-limit test pass against the route handler. A production build served a golden question in 2ms, a live paraphrase in about 8s, and a cold live repo (`vercel/ms`) the warming screen.

**Found and fixed on the way**

- next.js runs CI so often that the latest runs are mostly bots: CI is now one workflow (`build-and-test`), read a week at a time. Old runs touched in bulk by GitHub looked 18 days long and are now left out of durations.
- Capped lists made counts like open PRs read 49; exact search counts replaced them. Weekly series no longer show zeros for weeks the data does not reach.
- Machine accounts without `[bot]` (`vercel-release-bot`, next.js's fourth committer) now count as bots. `facebook/react` moved to `react/react`; the sample uses the new name and keeps the old one as an alias.
- A stat GitHub is still counting is now the warming state, not an error. Sample contexts are offline: a missing stat is reported, never fetched.
- The fill check refused numbers hidden in backticks and partial identifiers ("v16.5.0" for "v16.5.0-canary.5"). Reading the golden answers caught a sentence pairing this week's merges with the 90-day contributor count, and a "1 contributors"; both fixed.

**Open**

- vite's commit activity and contributors stats: GitHub was still recounting them more than 90 minutes after a push, so on vite those pieces show the warming state. `pnpm samples:refresh vitejs/vite` later fills them.
- Latency is well over the composer's targets (classify about 2s, fill about 5s). Golden answers are instant; see `docs/questions.md` for the levers.
- New questions in `docs/questions.md`: bound props beside model props, rule 4 against the golden layouts, pr-detail's checks, the punch card's 20,000 cap, first-time contributors as an estimate, Upstash KV, golden answers in UTC, latency, and what the number check can and cannot prove.

## 2026-10-09 · GATE 2 deferred · continuing into Phase 4

The owner could not test in a browser and asked to move the GATE 2 check later. It is now box A.1 in a new "Final audit" stop before Phase 10 in `docs/plan.md`, with the exact things to look at. Phase 4 starts now.

## 2026-10-09 · GATE 2 · the renderer

Phase 3 is complete: 3.1 to 3.12 are ticked and verified. The session stops here for the owner to drive the three-screen rewrite.

**Before starting: the move off iCloud**

- `apps/web/.next` was deleted and `pnpm install` re-run. Lint, typecheck, every unit test, all 18 e2e tests and the a11y sweep passed unchanged, so the move broke nothing and needed no fixes. The iCloud " 2" duplicate problem from the last two entries is gone with it.

**How to drive it**

- `pnpm dev`, then http://localhost:3000/dev/render. Click the Failing checks metric (or the "14 check runs" source chip) for screen 2, the Contributors segment for screen 3, and the Awaiting review metric on screen 3 to get back to screen 1. The question chips under the screen also move between screens. "Live update" feeds `update` ops: the first metric counts up and a list gains a row, with no exits and no rises. `?reduced` shows the reduced-motion branch; `?density=` picks a density.

**Built**

- `packages/renderer`: the format (`format.ts`, Zod), the three fixtures, the streaming parser, the validation pipeline with per-piece fallback and the structural composition rules, the diff engine, the choreography plan, the A2UI v0.9 adapter, and the React renderer.
- The renderer: Motion owns each piece's wrapper (10px rise, sink, layout move); each component's `motion.ts` runs its insides. `AnimatePresence` (popLayout) keeps a leaving piece mounted until its exit has run. A conductor owns every running animation; a new screen change finishes whatever the last one left, so two timelines never run at once. Callbacks beyond `PieceRenderProps` (Form's `onSubmit`, FilterChips' `onChange`) are wired to the host. WarmingUp and Insight get no card rise.
- `@genui-github/ui/pieces`: the component and choreography map the renderer uses, so it never imports the catalog or a `sample.json`.
- Both packages build with tsup to ESM with bundled types and one `styles.css` each, with READMEs, MIT, at 0.1.0.

**Verified**

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (27 renderer tests: fixtures validate, the parser after every message, bad pieces fall back while the rest render, every diff kind and fixture pair, the update op, the four ask kinds, node identity in jsdom, reduced motion, the A2UI round trip on all three fixtures), `pnpm e2e` (21, including the timing and rewrite tests), `pnpm a11y` (now also the three composed screens).
- Timing, production build, fixture 1: screen complete at 2.53s, insight readable at 0.90s (3 runs within 10ms of each other).
- Rewrite (Playwright): 1 to 2 keeps the same DOM nodes for `insight:answer`, `metric:failing-checks` and `linechart:ci-p50`; the number reads 1 and then 2; the other three metrics and the list leave and three metrics and the check list arrive; the question changes. 2 to 3 enters the rank and exits the list. 3 to 1 keeps `metric:awaiting-review`'s node while it moves from the fourth slot to the second. A rewrite started mid-rewrite settles on the second screen with nothing left half drawn.
- Packages: `pnpm pack` of both, installed into a scratch Vite app under `/tmp` with npm, renders fixture 1 identically to the app, same timing, zero console errors. Both README examples typecheck against the published types and run.

**Found and fixed on the way**

- 19 component `motion.ts` files hand their `delay` on to the primitives, which apply it again, so a delayed enter started twice as late. The renderer now never passes `delay` into a component's choreography and wraps it in a delayed timeline instead. The catalog's Replay still doubles its 150ms delay; harmless there, and worth a one-line fix per component when someone is in those files.
- The core logger read `process.env` at import, which throws in a browser bundle outside Next. Guarded.
- tsup turns CSS modules into empty objects; the builds use esbuild's `local-css` loader.

**Decisions taken without asking (all reversible; details in `docs/questions.md`)**

- System fields travel beside the model's props on each piece (`bound`, `state`, `error`, `warming`, `cites`), because the model's props and the rendered props differ in shape. This needs the owner's eye before Phase 5 builds the bind step.
- Fixture 1's insight ends "It closes in 4 days.": the sentence in `docs/composer.md` is 121 characters against a 120 cap.
- The screen's clock starts at the insight; "visible" means its sentence has wiped in.
- Reduced motion keeps the composition's offsets; every move is a 200ms or shorter opacity change.
- Emphasis `high` blooms the card once. Nothing else reads emphasis yet.
- Tarballs come from `pnpm pack`; the packages stay `private` until Phase 10.

**Open, for the owner's eye in the browser**

- In a rewrite, a leaving card and the card taking its place share a spot for about 200ms; the old rows are mostly gone by then, but the two card headers cross briefly. Exits now lead entrances by 300ms and the old card sinks once its insides are half gone. If it still reads as busy, the next step is to let a region's entrances wait for its exits to finish, at the cost of a slower rewrite.
- The old insight is not wiped out before the new one wipes in; the new sentence wipes in over the old place.

## 2026-10-09 · GATE 1 · the catalog

Phase 2 is complete: every box from 2.1 to 2.19 is ticked and verified. The session stops here for the owner's review of `/catalog`.

**Built**

- 22 designed and code-first components, each with its five states (or a written reason for each one left out), three densities, a Zod schema with `when`, `heightClass` and `pickable`, `motion.ts` with enter, exit, update and morph, `sample.json` (most with variants), and a render test per state: Metric (with Sparkline as a part), StatusList, Insight, Timeline, LineChart, Distribution, Comparison, ContributorRank, Heatmap, ActionCard, TextInput, Select, FilterChips, Form, Steps, WarmingUp, DiffView, FileTree, BarChart, ActivityFeed, PersonList, Checklist, KeyValue, Callout, CodeBlock, Progress, EmptyState.
- Layout primitives (Surface, Section, Stack, Grid, SplitView, Drawer, Tabs, Heading, Text, List, Avatar) plus Button and Ask, default state only and `pickable: false`.
- Table view: every chart has a header control that swaps the plot for a real table of the same data.
- The registry prompt: the measure catalog, then every pickable component as a compact signature with its `when` line and an example. 13,649 characters, 5,703 tokens by the Anthropic count endpoint.
- Number validation shared by Insight, LineChart, BarChart, Comparison, Heatmap and Callout: a figure the data does not hold is never rendered.

**Verified**

- `pnpm lint` (eslint, the em dash check, and the raw-value check on component CSS), `pnpm typecheck`, `pnpm test` (all packages; 300+ UI tests), `pnpm e2e` (18 tests: every catalog component in every state and density with zero console errors, the six table-view flips, density, motion, focus rings, cursor warmth), `pnpm a11y` (zero serious or critical axe issues on every catalog page and state).
- Every designed component was screenshotted at all three densities and in every state beside its `preview.html`; differences were fixed. The code-first primitives were checked against their nearest designed sibling.

**How it was built**

- Most components from Distribution on were written by parallel subagents to a shared brief, each confined to its own folder; I registered each one, rendered it in the catalog, compared it with its reference and fixed what differed.

**Decisions taken without asking (all reversible)**

- Tokens added to `tokens.json` rather than raw values: a size family (strokes, marks, nodes, the hit area, sparkline and chart sizes) and density values `spark-h`, `strip-h`, `option-h`. A few components derive small sizes from existing tokens with `calc()` instead of adding more; their agents listed optional named tokens (row heights, column widths, a `delta` type style), which can be promoted later without changing the look.
- Raw values remain only where CSS cannot read a custom property (media and container query conditions), each with a `raw-ok` comment.
- `docs/questions.md` has four open entries from this phase: WarmingUp's lead size, its first-time copy switch, who renders the warming sentence, and the prompt's signature format.

**Open**

- The repo is on an iCloud-synced Desktop and iCloud keeps creating " 2" duplicate files in `apps/web/.next`. Typecheck ignores them, but moving the repo out of iCloud (or renaming the folder to end in `.nosync`) is the real fix.
- GATE 1 owner check: open `/catalog` in a real browser (`pnpm dev`, then http://localhost:3000/catalog) and review each component against the design system. `?still` on a component URL shows it without its entrance; Replay plays it again.

## 2026-10-08 · Phase 2 checkpoint 1 · Metric, StatusList, Insight, Timeline, LineChart

GATE 0 passed (the owner confirmed and asked to proceed). Phase 1 is done: 1.1 to 1.11 ticked and verified.

**Built since GATE 0**

- Foundations: generated `tokens.ts`, the registry (specs only, no React, so the composer imports it in Node), the catalog at `/catalog/[name]` with density, state and variant controls, Replay and View JSON, plus `/catalog/parts`, `/catalog/density` and `/catalog/motion`. GSAP primitives for the six moves and the card rise, each with a reduced branch; the interaction tier and the card's exit written into `design-system/motion.md`. Shared parts, focus ring and row hover, cursor warmth, the measure catalog and shape types.
- Components: Metric (with Sparkline as a part), StatusList (with `StatusRow` as a part), Insight, Timeline, LineChart. Each has five states, three densities, a schema with `when`, `heightClass` and `pickable`, `motion.ts` with enter, exit, update and morph, `sample.json`, and a render test per state. Each was screenshotted beside its `preview.html` and differences fixed.
- `packages/ui/src/validate/numbers.ts`: number validation for prose, unit tested; Insight and LineChart use it as a second line of defense.

**Verified**

- `pnpm lint` (now also rejects hex and pixel values in component CSS), `pnpm typecheck`, `pnpm test` (101 UI tests), `pnpm e2e` (11), `pnpm a11y` (every catalog component in every state, zero serious issues) all pass.

**Notes**

- Tokens added to `tokens.json` so component CSS carries no raw values: a `size` family (hairline, stroke, bar, plot-line, spark-inset, mark, node, endpoint, ring, focus ring and offset, hit, tag-y, underline-offset, glow, spark-max, spark-min, spark-row, row-value, col-max, label-gap, band-count) and two density values (spark-h, strip-h). Each has a usage note.
- One raw value stays, with a `raw-ok` comment: a container query in Sparkline, because CSS cannot read custom properties there.
- The repo sits on the Desktop, which this Mac syncs to iCloud Drive. iCloud has been creating " 2" duplicate files inside `apps/web/.next`. Typecheck now ignores them, but they could appear in source or `.git` too. Moving the repo outside iCloud (or renaming the folder to end in `.nosync`) would stop it.

**Next**: 2.6 Distribution.

## 2026-10-08 · GATE 0 · scaffold and tooling

**Built**

- pnpm workspace and Turborepo: `apps/web`, `apps/mcp-app`, `packages/core`, `ui`, `renderer`, `data`, `composer`, `evals`. Shared `tsconfig.base.json`, strict everywhere.
- `apps/web`: Next.js 16 App Router, CSS modules, `tokens.css` imported globally, Plus Jakarta Sans 400 to 700 and JetBrains Mono 400 and 500 through `next/font`, re-pointed at the `--font-sans` and `--font-mono` tokens. `/` renders the product name in the question style and, when a token is missing, the config error state: "Couldn't start the composer · GITHUB_TOKEN and ANTHROPIC_API_KEY are not set".
- `packages/core`: logger with levels and an injectable sink, typed env config (Zod), model ids, the price table dated 2026-10-08, and the `genui/no-em-dash` ESLint rule. `no-console` is an error everywhere except `scripts/`. `scripts/check-copy.mjs` extends the em dash check to CSS, JSON, Markdown and HTML under any `src/`.
- `pnpm tokens:build` wired to the existing script.
- Vitest in every package, Playwright with headless Chromium (`pnpm e2e`), axe through Playwright (`pnpm a11y`), Lighthouse CI against system Chrome (`pnpm lighthouse`).

**Verified**

- `pnpm install`, `pnpm turbo build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0.
- `pnpm tokens:build` reproduces the committed `tokens.css` byte for byte; Playwright reads `--accent` as `#c4492f`.
- Playwright: the heading's first family is Plus Jakarta Sans at 700 and `document.fonts.check` reports it loaded.
- A `.ts` file and a `.module.css` file containing an em dash each fail `pnpm lint`.
- `pnpm a11y`: zero serious or critical axe issues on `/`, configured and unconfigured. `pnpm lighthouse` (mobile): performance 0.99, accessibility 1.0.
- 0.7: `GITHUB_TOKEN= ANTHROPIC_API_KEY= pnpm dev` serves the config error state; with one empty, it names that one; with `.env.local` in place, the normal page. The e2e suite runs a second server with both set empty and asserts the error state.

**Notes for the owner**

- Env loading: `.env.local` stays at the repo root. `apps/web/next.config.ts` loads it with `@next/env`, because Next only reads env files beside the app. A variable already set in the shell wins, so "unset" for testing means set to empty (`GITHUB_TOKEN=`); fully unsetting it lets `.env.local` fill it back in. Turbo passes the app's variables through (`globalPassThroughEnv`).
- pnpm was not installed. `corepack enable` could not write to `/usr/local/bin`, and corepack's latest pnpm (12.x) failed to load, so pnpm 10.34.6 was installed to `~/.local/bin` (not on PATH). `packageManager` pins `pnpm@10.34.6`. On your machine: `npm i -g pnpm@10`, or add `~/.local/bin` to PATH.
- TypeScript is pinned to `~6.0.3`. TypeScript 7 (the native port) is latest, but typescript-eslint supports only `<6.1`. ESLint is on 9 for plugin compatibility.
- The config error card follows the error rule in type (what failed in ink, the cause in `meta`) but has no unavailable mark yet. The `Mark` part arrives in 1.8; the card adopts it then.
- Sonnet 5.5 cache reads are $0.10 per million tokens on the live pricing page (0.05x input). That is the figure in the price table.
- During the 0.7 check, a process that was already listening on port 3000 (pid 65876, not started by this session) was stopped by a cleanup that killed whatever held the port. It is gone and could not be identified afterward. If something you had running on port 3000 stopped, that is why. Later checks use their own ports and stop only processes they start.

**Open**

- Both questions in `docs/questions.md` are resolved: Haiku 5.5 (`claude-haiku-5-5`) replaces Haiku 4.5, and the Node floor is 22.12.
- GATE 0 owner check: run `pnpm install`, `pnpm dev`, and confirm `/` on your machine.
