# Build plan

The checklist from empty folder to launch. Work top to bottom. Tick a box only when its done criterion is verified. `GATE` means stop, write `docs/status.md`, end the session; the owner reviews before the next phase starts. `CHECKPOINT` means commit, update `docs/status.md`, continue. `OWNER` marks a task only the owner can do: skip it, note it in `docs/questions.md`, and do not let it block the gate. Each phase has a prompt in `prompts/` that names the docs it needs.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done and verified.

---

## Phase 0 · Scaffold and tooling

Prompt: `prompts/00-bootstrap.md`

- [x] 0.1 pnpm workspace + Turborepo with `apps/web`, `apps/mcp-app`, `packages/core`, `packages/ui`, `packages/renderer`, `packages/data`, `packages/composer`, `packages/evals`. Done when `pnpm install` and `pnpm turbo build` succeed with empty packages.
- [x] 0.2 TypeScript strict in every package, shared `tsconfig.base.json`. Done when `pnpm typecheck` passes.
- [x] 0.3 Next.js app in `apps/web` with the App Router, CSS modules, fonts through `next/font` (Plus Jakarta Sans 400/500/600/700, JetBrains Mono 400/500). Done when `/` renders "Generative UI for GitHub Repos" in the display face.
- [x] 0.4 `pnpm tokens:build`: `scripts/tokens-build.mjs` generates `design-system/tokens.css` from `design-system/tokens.json` (color, spacing, radius, shadow, type families and styles, and the `density` family as the three `[data-density]` blocks plus the under-640px step-down). Done when running it reproduces the committed `tokens.css` byte for byte, and a Playwright check reads `--accent` as `#c4492f` in the browser.
- [x] 0.5 `packages/core`: logger (levels; `console.log` banned by lint elsewhere), config loader with a typed schema, the no-em-dash ESLint rule applied to every `src/`, and the price table with model ids from `docs/decisions.md`. Done when a file containing an em dash fails `pnpm lint`.
- [x] 0.6 Vitest in every package with one passing smoke test; Playwright with headless Chromium for `apps/web` (`pnpm e2e`); axe-core wired into Playwright (`pnpm a11y`); Lighthouse CI (`pnpm lighthouse`). Done when all four commands run green on the scaffold.
- [x] 0.7 `.env.example` as committed; `.env.local` gitignored. Done when `pnpm dev` starts without a real token and `/` shows the config error state in the system's words.
- [x] 0.8 `docs/status.md` and `docs/questions.md` exist with headers; first local commit. Done when `git log` shows one commit and `git status` is clean.

`GATE 0` · the owner checks the scaffold runs on their machine and places `.env.local`.

---

## Phase 1 · Foundations in code

Prompt: `prompts/01-foundations.md`

- [x] 1.1 Verify the token additions are present in `design-system/tokens.json` and `tokens.css` (`radius-xs`, type styles `handle`, `value`, `hint`, `section`, `lead`, the `density` family, `scrim`, `sheet`). Done when `pnpm tokens:build` is a no-op diff and a unit test reads each from the generated CSS.
- [x] 1.2 `packages/ui/src/tokens.ts`: a typed export of every token name. Done when a misspelled token fails `pnpm typecheck`.
- [x] 1.3 `packages/ui/src/registry.ts`: the `ComponentSpec` type (name, zod schema, `when`, `heightClass`, `pickable`, `statesOmitted` with reasons), `register()`, `toPrompt()`, `heightClass(name)`, `deriveId(component, props)`. Done when typecheck passes and a unit test registers a dummy spec and reads it back.
- [x] 1.4 Catalog page `/catalog` in `apps/web`: iterates the registry, renders each component from its `sample.json` in every state and density, with a disabled segment for skipped states and a View JSON control. Done when it renders the dummy spec from 1.3 and no errors.
- [ ] 1.5 Density: `data-density` on the screen root drives the density variables, with the under-640px step-down. Done when `/catalog/density` renders three roots and a Playwright test reads `--metric-size` on a test element as 30, 38, 46px, and 38px for spacious at 600px wide.
- [ ] 1.6 Motion primitives in `packages/ui/src/motion/`: `wipe`, `extend`, `slide`, `draw`, `count`, `bloom`, plus `rise` for cards. GSAP functions taking a node and returning a timeline; timings and easings from `design-system/motion.md`; a reduced-motion variant of each. Done when `/catalog/motion` runs all seven on dummy nodes with no console errors, a unit test asserts each timeline's duration and ease, and with `prefers-reduced-motion` stubbed each is a 200ms opacity change.
- [ ] 1.7 Interaction-speed tier in `motion.ts` and `design-system/motion.md`: message wipe 350ms, menu 180ms, fold 350ms, chip choose 150 to 200ms. Done when a unit test asserts the four durations.
- [ ] 1.8 Shared parts in `packages/ui/src/parts/`: `Mark` (good, warn, crit, neutral, unavailable, warming, node, endpoint), `Tag` (text on 10% tint; `quiet`), `TextLink` (`accent-text`, 35% underline, 36px hit area), `CardFrame` (surface, border, radius, shadow, header slot, table-view control slot), `Skeleton`, `StateRow`, `Spine`, `RepoChip` (mono), `Segmented`. Done when each has a render test and renders on `/catalog/parts`.
- [ ] 1.9 Focus and hover as shared CSS: 2px `focus` ring at 2px offset; row hover lifts onto `surface-tint` inset `space-2` with neighboring hairlines hidden; `prefers-contrast: more` turns resting field and chip borders `muted`. Done when a Playwright test tabs through `/catalog/parts` and every interactive element shows the ring.
- [ ] 1.10 Cursor warmth as a shell component. Done when a Playwright test moves the pointer and the gradient position follows, with frame time under 16ms in the trace.
- [ ] 1.11 `packages/data/src/measures.ts`: the measure catalog from `docs/schemas.md` as typed ids with unit, direction and formatter (no fetching yet); `packages/data/src/shapes.ts`: the shape names and types from the `docs/data-layer.md` table (no fetching yet). Done when a test lists every measure id and formats a sample value per unit, and every shape name in `docs/data-layer.md` has a type.

Continue into Phase 2 without stopping.

---

## Phase 2 · The catalog

Prompt: `prompts/02-catalog.md`. Each component's behavior spec is `design-system/components/<Name>/README.md`; its prop names are in `docs/schemas.md`; its reference rendering is `preview.html`.

A designed component is done when: its five states and three densities render on `/catalog` from `sample.json`; its schema is registered with `when`, `heightClass` and `pickable`; `motion.ts` has enter, exit, update, morph composed from the primitives; one render test per state passes; lint passes; no raw values in its CSS module; a Playwright screenshot at comfortable density sits beside its `preview.html` screenshot and the executor has compared them and fixed visible differences.

- [ ] 2.1 Metric, with Sparkline as a part (`trend: true` renders it from the measure's series; the sample supplies the series directly).
- [ ] 2.2 StatusList with `kind` and per-kind state enums; tag words written by the system; Row as a part.
- [ ] 2.3 Insight, accepting a `sources` map prop that the renderer will supply in Phase 3; the number-validation function lives in `packages/ui/src/validate/numbers.ts` and is unit tested here.
- [ ] 2.4 Timeline (`merged` and `commits` kinds, `dayAsk`), using `Spine`.
- [ ] 2.5 LineChart (one series, two series, failure strip); Sparkline is a part and is not registered.

`CHECKPOINT` · commit, status, continue.

- [ ] 2.6 Distribution.
- [ ] 2.7 Comparison.
- [ ] 2.8 ContributorRank.
- [ ] 2.9 Heatmap, Monday first, with the table view control.
- [ ] 2.10 ActionCard: typed `effect`, sample mode only, the 400ms activation guard, focus management.

`CHECKPOINT` · commit, status, continue.

- [ ] 2.11a TextInput, Select, FilterChips as fields sharing `--control-h`; the two error kinds; validation wording written by the system.
- [ ] 2.11b Form, composing the three fields.
- [ ] 2.12 Steps, using `Spine`.
- [ ] 2.13 WarmingUp, built against the `WarmingStatus` type in `docs/schemas.md`.
- [ ] 2.14a DiffView: fold at 40, stop at 1,000, soft wrap by default, scroll for indentation-significant files, `<mark>` word highlights.
- [ ] 2.14b FileTree: middle truncation, open all at 20 or fewer, 3,000-file cap, the phone layout.
- [ ] 2.15a Data primitives, charts and lists: BarChart, ActivityFeed, PersonList, Checklist. Rule: five states, three densities, schema, `motion.ts`, `sample.json`, render tests; no preview to compare, so the executor checks them against the nearest designed sibling (BarChart against LineChart, lists against StatusList).
- [ ] 2.15b Data primitives, text and blocks: KeyValue, Callout, CodeBlock, Progress, EmptyState. Same rule as 2.15a.
- [ ] 2.15c Layout primitives, default state only, `pickable: false`, no `sample.json`, a one-line README stub "layout has no data": Surface, Section, Stack, Grid, SplitView, Drawer, Tabs, Heading, Text, List, Avatar. Button and Ask keep their existing READMEs (Ask's 60ms stagger and key hints are superseded by decisions 12 and 56).
- [ ] 2.16 Table view for every chart (LineChart, Distribution, Comparison, ContributorRank, Heatmap, BarChart): a header control that swaps the plot for a real table of the same data. Done when a Playwright test flips each one on `/catalog`.
- [ ] 2.17 Height classes assigned per `docs/decisions.md`. Done when a unit test asserts `registry.heightClass('Metric') === 'fixed'`, `('StatusList') === 'grows'`, `('LineChart') === 'plot'`.
- [ ] 2.18 `registry.toPrompt()` complete: measure catalog plus every pickable component. Done when a test asserts the prompt's character count is under 24,000 (roughly 7,000 tokens) and, when `ANTHROPIC_API_KEY` is present, a second test counts tokens with the Anthropic token-count endpoint, asserts under 7,000, and records the count in `packages/ui/fixtures/prompt-tokens.json`; the second test skips with a note when the key is absent.
- [ ] 2.19 Catalog page complete: every registered component, every state, every density, the table-view flips, the disabled segments, View JSON. Done when Playwright loads it with zero console errors and axe reports zero serious issues.

`GATE 1` · the owner reviews `/catalog` against the design system in a real browser.

---

## Phase 3 · Renderer

Prompt: `prompts/03-renderer.md`

- [ ] 3.1 UI description format in `packages/renderer/src/format.ts`, exactly as `docs/schemas.md` defines Composition, Piece, Built, the five regions and the six stream ops. Done when the three fixtures in `packages/renderer/fixtures/` (from `docs/composer.md`) validate.
- [ ] 3.2 Streaming parser: accepts the six ops and builds the tree incrementally. Done when a test feeds messages one at a time and the tree is correct after each.
- [ ] 3.3 Validation and fallback per the pipeline in `docs/schemas.md`: an unknown component, a failing schema, a missing measure or a rule violation renders that piece's error state and logs; the rest renders; nothing throws. Done when a test with one bad node renders the other nodes.
- [ ] 3.4 React renderer: tree to React with Motion `AnimatePresence` and `layout` on each piece's wrapper, region containers using the density and region-gap tokens, `key` = `id`. Done when fixture 1 renders on `/dev/render`.
- [ ] 3.5 Enter choreography: each piece runs its `enter`, regions staggered 160 to 200ms top to bottom, metrics 80ms apart. Done when performance marks show fixture 1 complete in 2.2 to 2.6s with the insight visible under 1s.
- [ ] 3.6 Diff engine: current tree and next tree → `exit`, `enter`, `morph`, `keep`. Done when unit tests cover all four and the three fixture pairs.
- [ ] 3.7 Rewrite choreography: exits per region just ahead of entrances, top to bottom; survivors morph via `motion.ts morph` and Flip; a new rewrite kills the running timeline; the header question wipes out and in. Done when a Playwright test on `/dev/render` rewrites 1→2, 2→3, 3→1 and asserts the DOM node for `metric:failing-checks` is the same object before and after 1→2 (node identity), its number counted 1→2, and no survivor remounted.
- [ ] 3.8 Update path for live data without a rewrite: numbers count, bars extend or retract, a new row slides into place with Flip. Done when a test feeds an `update` op and the diff reports no exit and no enter.
- [ ] 3.9 Interaction events: a click on a piece with `ask`, a day heading with `dayAsk`, a heatmap cell with `cellAsk`, or a source chip with `ask` emits `{ ask, from: id }` to the host. Done when a test captures all four.
- [ ] 3.10 A2UI adapter: `toA2UI(tree)` and `fromA2UI(messages)`, round-trip tested on the three fixtures. Done when round trip is lossless.
- [ ] 3.11 Reduced motion: every choreography path has a reduced branch. Done when a test with the media query stubbed asserts no timeline longer than 200ms.
- [ ] 3.12 Package build: `@genui-github/renderer` and `@genui-github/ui` build to ESM with types, a README each with install and a 20-line usage example, MIT. Done when `npm pack` produces tarballs and a scratch Vite app under `/tmp` renders fixture 1 from them.

`GATE 2` · the owner drives the three-screen rewrite in a browser.

---

## Phase 4 · Data layer

Prompt: `prompts/04-data.md`. Spec: `docs/data-layer.md`.

- [ ] 4.0 `packages/composer/src/templates/needs.ts`: the 15 template ids with the data shapes and measures each needs (no compose logic). Done when a test lists all 15 and every shape and measure name resolves in `packages/data/src/shapes.ts` and `measures.ts` from 1.11.
- [ ] 4.1 Octokit client with the server-side token, rate-limit header logging, `GitHubError` (status, endpoint, resetAt, retryAfter). Done when a test mocks a 403 and the error carries all fields.
- [ ] 4.2 Repo resolver. Done when the ten cases in `docs/data-layer.md` pass.
- [ ] 4.3a GraphQL entity fetchers: repo, pulls, issues, milestones, with recorded fixtures. Done when each has a fixture test.
- [ ] 4.3b REST fetchers: releases and tags, community, commits, workflow runs, run timing, checks, compare, PR files, tree, readme, with recorded fixtures. Done when each has a fixture test.
- [ ] 4.4 Stats fetchers with 202 handling and the backoff, returning `WarmingStatus`. Done when a test with a 202, 202, 200 sequence yields warming twice then data, with the right `nextCheckMs` each time.
- [ ] 4.5 Verify the five unverified facts with one real call each; record answers and dates in `docs/data-layer.md`; adjust fetchers if a fact is wrong and note it in `docs/decisions.md`. Done when the doc has five dated answers.
- [ ] 4.6 CHAOSS module. Done when unit tests on a fixture match hand-computed values for all five metrics.
- [ ] 4.7 Measures implemented: every id in `measures.ts` computes from the shapes for a repo and window. Done when a fixture test computes every measure on the next.js fixture and the values are sane (non-negative, units right).
- [ ] 4.8 Derived shapes per `docs/data-layer.md`. Done when each has a fixture test.
- [ ] 4.9 Cache behind one interface, memory and KV backends, keys and TTLs per the spec. Done when a test shows a second fetch inside 15 minutes hits the cache and a stats key changes when the SHA changes.
- [ ] 4.10 Data context builder: repo and template id → `DataContext` with `cachedAt` on every shape, `WarmingStatus` when any stat is cold, and a token estimate. Done when the release-blockers context for the next.js fixture is under 3,000 tokens.
- [ ] 4.11 `pnpm samples:refresh` for the five sample repos; commit the JSON. Done when all five load in under 50ms and the script printed the request count.

Continue into Phase 5 without stopping.

---

## Phase 5 · Composer

Prompt: `prompts/05-composer.md`. Spec: `docs/composer.md`.

- [ ] 5.0 Eval set authored as data in `packages/evals/set/` per `docs/evals.md` (99 cases). Done when the set loads and validates against its schema. (Authored here because 5.2 and 5.5 test against it; Phase 7 builds the runner.)
- [ ] 5.1 Anthropic client via the official SDK, prompt caching on the registry block, cost accounting from the price table. Done when a test asserts the cost math on a mocked response.
- [ ] 5.2 Classifier (Haiku). Done when the 12 golden questions and the 20 paraphrases classify correctly against a recorded fixture of responses, and a live run over them matches at 90% or better.
- [ ] 5.3a The 12 golden templates, one module each, deterministic, no model call. Done when all 12 produce a valid tree from each sample repo.
- [ ] 5.3b The 3 follow-up templates (`check-failures`, `pr-detail`, `person`). Done when each produces a valid tree from a click on the matching fixture.
- [ ] 5.4 Prose fill (Haiku) for Insight sentences, LineChart and Comparison findings, Metric deltas, Heatmap summaries, with number validation. Done when 100 runs over the samples yield zero unvalidated numbers reaching the tree.
- [ ] 5.5 Off-template composition (Sonnet), streaming JSONL. Done when the 10 off-template eval cases produce valid trees.
- [ ] 5.6 Composition rules enforced in code. Done when each rule has a test that rejects a violating tree.
- [ ] 5.7 `POST /api/compose` with the per-visitor limit, cached golden questions, and the daily cap. Done when a test exhausts the visitor limit and gets the rate-limit response, and a test with the Anthropic client mocked asserts zero calls for a golden question on a sample repo.
- [ ] 5.8 The built payload on every composition. Done when the route's final message carries every `Built` field.
- [ ] 5.9 `pnpm compositions:refresh`: runs the 60 golden compositions (12 × 5 samples) once with the fill step, validates them, writes them under `packages/composer/golden/`, and commits them. The route serves these with zero model calls. Done when the 60 files exist and the zero-call test in 5.7 passes against them.

`GATE 3` · the owner runs the twelve golden questions on next.js locally and reads the compositions.

---

## Phase 6 · App shell

Prompt: `prompts/06-shell.md`. Reference renderings: `design-system/screens/*.html` (open them in a browser; `genui.css` and `shell.css` beside them).

- [ ] 6.1 Landing `/`: matches `screens/Landing.html` with the twelve golden questions as the chips (grouped Shipping, Health, People, Getting started), one sample preselected, the hero field, the scaled preview with an `@supports` fallback. Done when Playwright screenshots at 1440 and 390 are compared to the reference and visible differences are fixed.
- [ ] 6.2 Composed screen `/r/[owner]/[name]?q=`: `screens/Main.html`. Share URL replays from cache. Done when the twelve golden questions render from the samples with the full entrance.
- [ ] 6.3 Chrome entrance and exit. Done when `r` replays the whole screen out and in.
- [ ] 6.4 The tray with the density segmented control and the ask field; disabled with the reset time when the app can't take a question. Done when the rate-limit state shows it disabled with a real time.
- [ ] 6.5 The drawer: `screens/Drawer.html`. Done when it opens from the built block and the strip.
- [ ] 6.6 Warming screen: `screens/Warming.html`. Done when `?force=warming` shows it and a cold live repo hands off to a composition.
- [ ] 6.7 Rate limit, daily cap, near-empty: `screens/RateLimit.html`, `DailyCap.html`, `NearEmpty.html`. Done when each is forced with its query flag.
- [ ] 6.8 Click to recompose. Done when clicking "Failing checks" on release-blockers rewrites to check-failures with the survivor metric morphing.
- [ ] 6.9 Mobile: one column under 640px, spacious steps down, StatusList wrap rule, DiffView scroll rule, Heatmap sticky labels. Done when every golden question renders at 390 with no horizontal scroll (Playwright asserts `scrollWidth === clientWidth`).
- [ ] 6.10 Returning visitor offer. Done when a second visit shows it.
- [ ] 6.11 The "how this works" overlay: `screens/HowItWorks.html`. Done when it opens, animates, closes with Escape, and the page behind is `inert`.
- [ ] 6.12 Footer line on every page. Done when a Playwright test finds it on `/`, `/r/...`, `/catalog`, `/evals`, `/about`.
- [ ] 6.13 Accessibility pass. Done when `pnpm a11y` reports zero serious issues on every screen and fields are 16px under 480px.

`GATE 4` · the owner uses the app end to end on desktop and phone.

---

## Phase 7 · Evals

Prompt: `prompts/07-evals.md`. Spec: `docs/evals.md`.

- [ ] 7.1 Scorers with unit tests. Done when each scorer has a test.
- [ ] 7.2 Runner: calls the composer directly (not the route, so limits and the cap do not apply), three runs each for `production`, `sonnet`, `haiku`, writes `packages/evals/results/<date>-<model>.json`. Done when one full run completes and every case has every score.
- [ ] 7.3 Results page `/evals`: `screens/Evals.html`, composed from the catalog. Done when it renders the latest results.
- [ ] 7.4 Regression gate `pnpm evals:check`: fails if template accuracy or bindings on the 60 golden cases drop below the last recorded `production` run. Done when a deliberately broken template fails it.
- [ ] 7.5 Commit the first baseline results (override the gitignore for this one file set). Put the aggregate table in `docs/status.md`. Done when `git show --stat` lists the three results files and `docs/status.md` carries the table.

Continue into Phase 8 without stopping.

---

## Phase 8 · MCP App

Prompt: `prompts/08-mcp.md`

- [ ] 8.1 Write `docs/dark-theme-brief.md` for the owner to hand to design: every token needing a dark value, the grounds each contrast figure is redone on, the special cases (hot card, heat ramp, diff tints, focus ring, crit on dark). Done when the file exists. `OWNER` takes it from there.
- [ ] 8.2 `apps/mcp-app`: an MCP server exposing `compose(repo, question)` and returning a UI resource per the current MCP Apps spec (read it from the official source; record the version in `docs/decisions.md`). Done when the MCP inspector lists the tool and returns a resource.
- [ ] 8.3 The frame entry: `screens/MCPApp.html`; 420px design width, 360px floor, container queries, regions only, the composer told the frame width. Done when the three fixtures render inside a 420px iframe with no horizontal scroll.
- [ ] 8.4 `OWNER` Test in Claude Desktop: "show me the health of vercel/next.js" composes in the pane.

`GATE 5` · the owner tries the MCP App in Claude and hands the dark-theme brief to design.

---

## Phase 9 · Dark theme, hardening, cost controls

Prompt: `prompts/09-hardening.md`

- [ ] 9.0 Dark theme, when the owner has added it to `design-system/tokens.json`: `pnpm tokens:build` emits the `[data-theme="dark"]` block and the `prefers-color-scheme` default; every component checked on `/catalog` in dark; the MCP frame follows the host theme. Done when `pnpm a11y` on `/catalog` in dark reports zero contrast failures. If the tokens have not arrived, skip, note in `docs/questions.md`, and continue.
- [ ] 9.1 Error boundaries per region. Done when a test throws inside one region's component and the other regions render.
- [ ] 9.2 `/api/health`: cache hit rate, model calls today, spend today, GitHub rate remaining. Done when `curl` returns the four fields.
- [ ] 9.3 Cost controls under load with `DAILY_CAP_USD=0.50` in the test env: a script fires 500 compositions at the samples and asserts zero model calls; a second fires 50 live questions from 5 visitors and asserts the visitor limit trips and then the cap trips. Done when both scripts pass.
- [ ] 9.4 Security: `scripts/check-secrets.sh` greps the build output and client bundles for the token and key patterns; repo input validated server side; no user content stored. Done when the script exits 0 on a production build.
- [ ] 9.5 Performance: `pnpm lighthouse` on `/` and a composed sample screen. Done when mobile performance ≥ 90 and accessibility ≥ 95.
- [ ] 9.6 Root README per `docs/launch.md`. Done when it contains every section listed there.

---

## Phase 10 · Launch

Prompt: `prompts/10-launch.md`. Spec: `docs/launch.md`.

- [ ] 10.1 `OWNER` Deploy to Vercel with env vars and KV. The executor prepares `vercel.json` and a deploy checklist in `docs/status.md`. Done (executor side) when `vercel.json` exists, `pnpm build` passes in production mode, and the checklist is in `docs/status.md`.
- [ ] 10.2 Prepare the npm tarballs and verify them in a scratch project; `OWNER` runs `npm publish`. Done (executor side) when `npm pack` output installs and renders fixture 1.
- [ ] 10.3 `OWNER` Record the 60-second video from the shot list in `docs/launch.md`.
- [ ] 10.4 About page in the app (`screens/About.html`), portfolio page copy and the LinkedIn post drafted in `docs/launch.md` for `OWNER` approval. Done (executor side) when the About page renders and the drafts are in the doc.
- [ ] 10.5 Final checks from `docs/launch.md`, run against production once the owner has deployed. Done when every item is true; `docs/status.md` says done.

`GATE 6` · ship.
