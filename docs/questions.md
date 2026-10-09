# Questions for the owner

Append only. Each entry: the plan task id, the question, what was assumed, and what to check. The owner answers in place; a resolved entry gets `resolved:` and the answer, and the related decision is added to `docs/decisions.md`.

## 0.5 · Haiku 5.5 is on the price list

The pricing page read on 2026-10-08 lists Claude Haiku 5.5 at $0.10 input and $0.50 output per million tokens (prompts up to 100,000 tokens), a tenth of Haiku 4.5. `docs/decisions.md` names `claude-haiku-4-5-20251001` for classify and fill.

- Assumed: keep Haiku 4.5 as decided. `packages/core/src/models.ts` and `prices.ts` carry only the two decided models.
- Check: whether to move the classifier and prose fill to Haiku 5.5. If yes, add it to the decisions; Phase 5 and the eval runs pick it up from `models.ts`.
- resolved: switch to Haiku 5.5 (owner, 2026-10-08). `models.ts` now names `claude-haiku-5-5`; the price table carries both of its prompt-length tiers; `docs/decisions.md` Model routing updated.

## 0.1 · Node version floor

`docs/decisions.md` says Node 20+. Vitest 5 (current) requires Node 22.12 or later, and Next 16 requires 20.9.

- Assumed: root `engines.node` is `>=22.12.0`. This machine runs 22.14.
- Check: that Node 22 or 24 is fine for local work and Vercel. If Node 20 must stay, pin Vitest 4 instead.
- resolved: take the newest tooling and the 22.12 floor (owner, 2026-10-08). Node 20 is past end of life, so the original "Node 20+" carried no constraint worth keeping. `docs/decisions.md` Stack updated.

## 2.13 · WarmingUp's lead sentence size

The `lead` type style in `tokens.json` is a fixed 22px. The WarmingUp README says the sentence follows density (16, 19, 22px, the Insight sizes), and the preview uses 1.35 leading.

- Assumed: the sentence uses `--insight-size` (follows density) with the lead style's leading and weight.
- Check: whether `lead` should become density-driven in `tokens.json`, or stay fixed at 22px.

## 2.13 · When WarmingUp says "still counting" instead of "for the first time"

`WarmingStatus` carries nothing that says whether this is the first attempt at a repo or a retry, and the README has two copies.

- Assumed: the copy switches at the fifth check (28s), just after the axis first doubles. A run restarted by Try again says "for the first time" again.
- Check: whether the data layer should add a `firstTime` flag to `WarmingStatus` in Phase 4.

## 2.13 · Who renders the warming sentence

`docs/schemas.md` says the shell renders the system sentence in the insight region and WarmingUp in `main`. The WarmingUp README and `screens/Warming.html` draw the sentence as part of WarmingUp, above its card.

- Assumed: WarmingUp renders its own sentence; the shell (Phase 6) places the whole component where the composition goes and adds no second sentence. Its `enter` runs the card rise itself, so the renderer must not wrap it in another rise.
- Check: that this reading is right before Phase 6.

## 2.18 · The registry prompt writes schemas as signatures, not JSON Schema

`docs/schemas.md` says the prompt carries "the JSON Schema of the model-facing props" and must stay under 7,000 tokens. With every component registered, JSON Schema came to 8,357 tokens even after naming shared enums once.

- Assumed: each component's props are written as a TypeScript-like signature generated from its JSON Schema (`{measure: Measure; label?: string(≤28); hot?: boolean}`), with a short legend at the top. Same names, optional marks, enums and limits. The count is 5,703 tokens (`packages/ui/fixtures/prompt-tokens.json`).
- Check: that this is acceptable. If the composer evals in Phase 7 show the model reads JSON Schema better, the cut would have to come from elsewhere (dropping the examples saves about 900 tokens).

## 3.1 · Bound props travel beside the model's props

`docs/schemas.md` gives `Piece` one `props` field "validated against that component's schema", and `docs/composer.md` says the fixtures "carry system-bound props". The two cannot be one object: the model-facing schemas are strict and differ in shape from what the components render (LineChart's model `series` is `{ measure, name }`, its rendered `series` is `{ name, points }`), and stable ids derive from the model's props.

- Assumed: `Piece.props` stays the model's props (validated, used for the id). System fields sit beside it: `bound` (what the component renders; absent means the skeleton), `state`, `error`, `warming`, and `cites` (numbers a Metric delta may quote beyond its own value). An `update` op's `props` replaces `bound`, since the model's choices never change without a rewrite. All in `packages/renderer/src/format.ts`.
- Check: that this is acceptable before Phase 5 builds the bind step to it; if so, add the system fields to `docs/schemas.md`.

## 3.1 · Fixture 1's insight sentence is one character over the limit

The sentence in `docs/composer.md` ("... The milestone closes in 4 days.") is 121 characters; Insight's `sentence` caps at 120.

- Assumed: fixture 1 says "It closes in 4 days." instead. Same facts and numbers.
- Check: whether the cap should be 140 instead. Real sentences of this shape will hit 120 often.

## 3.5 · Where the screen's clock starts, and what "insight visible" means

`design-system/motion.md` puts the chrome first and the insight 160 to 200ms after it, and says the answer is visible in under a second. The insight's wipe alone is 900ms, so starting it 160ms after the chrome would finish it at 1.06s.

- Assumed: the renderer's clock starts at the insight (the answer arrives first), and its header question wipes at the same moment. The shell's chrome (eyebrow, built block, question chips) runs outside it in Phase 6. "Visible" is when the insight's sentence has finished wiping in (its rule keeps drawing after). Measured on fixture 1 in a production build: insight at 0.90s, screen complete at 2.53s, regions 180ms apart, metrics 80ms apart.
- Check: whether the chrome should lead the insight in the shell, which would push "visible" to about 1.06s.

## 3.11 · "No timeline longer than 200ms" under reduced motion

`motion.md` keeps the composition's order and offsets under reduced motion, so a staggered list still fades row by row 70ms apart, and its timeline runs longer than 200ms in total.

- Assumed: the test asserts every move (each target's own tween) is an opacity change of 200ms or less, and that the wrapper's Motion animations are opacity-only at 200ms. Offsets stay.
- Check: whether reduced motion should also drop the offsets, so everything fades at once.

## 3.7 · What `emphasis` looks like

No component reads `emphasis`, and the docs give it no appearance. Fixture 2 re-emphasizes the CI chart ("the failure strip comes forward").

- Assumed: a piece whose emphasis rises to `high` blooms once (the warmth ActionCard has on arrival, behind its card). Nothing else changes.
- Check: whether `high` should also change the card (a stronger border, the strip's contrast) and what `low` should do.

## 3.12 · `pnpm pack`, not `npm pack`, and the packages stay private

`npm pack` on a pnpm workspace package ships the raw manifest: exports pointing at `src/*.ts` and `workspace:*` ranges, which no consumer can install. `pnpm pack` applies `publishConfig` (exports and types from `dist`) and rewrites `workspace:*` to the real version.

- Assumed: the tarballs are made with `pnpm pack`. Both packages are at 0.1.0, MIT, with `private: true` kept so nothing can be published by accident before 10.2 claims the scope. `@genui-github/core` and `@genui-github/data` are bundled into the builds rather than published.
- Check: that Phase 10 should drop `private` and publish with `pnpm publish`. The dist files carry no `'use client'` directive (bundling drops it); a Next.js consumer imports the React parts from a client component.

## 4.9 · Vercel KV is now Upstash Redis

`@vercel/kv` is deprecated; Vercel KV stores are Upstash Redis databases, and Vercel sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` for them. `docs/data-layer.md` says to switch on `KV_URL`.

- Assumed: the KV backend uses `@upstash/redis` and switches on when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are both set; otherwise memory. Entries store `{ value, cachedAt }` with Redis expiry for the TTL.
- Check: that the production store is a Vercel-provisioned Upstash Redis (Phase 10 deploy checklist).

## 4.7 · First-time contributors is an estimate

GitHub reports `authorAssociation` as it is today, so a first merge already reads CONTRIBUTOR. The measure counts merged-PR authors in the window with no commits before it in `stats.contributors`, which lists only the top 100 authors. On a large repo, an occasional contributor outside the top 100 counts as first-time.

- Assumed: keep the estimate; Phase 5 prose should not claim it as exact.
- Check: whether to pay for an exact count (one commits query per candidate author, about 20 to 40 requests per repo) or drop the measure from `new-contributor`.

## 4.5 · The punch card stops at 20,000 commits

On next.js the punch card's cells sum to exactly 20,000. On smaller repos it is all-time (vite: 9,692 against 1,223 in the last 52 weeks).

- Assumed: the punch card is all-time up to GitHub's 20,000-commit cap. The Heatmap's title stays "When commits land" (decision 45) and the system's meta line should say "all time" without a number.
- Check: nothing unless the Heatmap copy should mention the cap.

## 4.11 · facebook/react is now react/react

GitHub answers `facebook/react` with 301 Moved Permanently to `react/react`. `docs/decisions.md` lists `facebook/react` as a sample.

- Assumed: the sample is stored under the canonical `react/react`, and `facebook/react` is an alias, so a pasted old link still finds the sample (the resolver returns the canonical name from the API). The landing chip in Phase 6 shows `react/react`.
- Check: that the landing should show the new name, and update the sample list in `docs/decisions.md` if so.

## 5.3a · Rule 4 and the golden layouts disagree

Composer rule 4 says two `grows` pieces never share a row, but `docs/golden-questions.md` sets them side by side in five templates (merged-recent and punch-card: Timeline or Heatmap with a PersonList; biggest-pr and pr-detail: DiffView with a FileTree; release-diff: Timeline with a FileTree; person: Timeline with a StatusList).

- Assumed: the golden table is the design, so the grows pair is checked only for a free (off-template) composition, in both the composer and the renderer (`free` in `ValidateOptions`). Every other part of rule 4 applies to all compositions.
- Check: whether those layouts should change instead (for example a chart or a fixed piece beside each list).

## 5.3b · pr-detail shows the pull request's facts, not its checks

`docs/golden-questions.md` stacks a StatusList of checks below pr-detail's DiffView, but the check runs in the data are the default branch head's, not the pull request's.

- Assumed: a KeyValue of the pull request's own facts (author, size, review state, wait) takes that place. Fetching a pull request's own checks is one more call (`/commits/{head}/check-runs`) when that template runs.
- Check: whether to add that call in Phase 6 so the checks list can come back.

## 5.2 to 5.5 · Latency is well over the targets

`docs/composer.md` targets 300ms to classify, 600ms to fill, first piece under 1s and done under 2.5s on a cached sample; off-template first piece under 2s, done under 6s. Measured (Haiku 5.5 at effort `low`, Sonnet 5.5 at `medium`, structured outputs): classify about 1.6 to 2.5s; fill p50 4.7s, p90 6.3s; a live template composition about 8s end to end; off-template first piece 1.5 to 5s, done 4 to 7s.

- Assumed: correctness first; the golden questions on samples are served from the committed compositions in milliseconds, so the targets bite only on live repos and paraphrases. Tuning (effort, `max_tokens`, dropping structured outputs for the classifier, a smaller fill prompt, or skipping the fill on live repos) belongs with the Phase 7 evals, which can measure the quality cost of each.
- Check: whether the targets should move, or which lever to pull first.

## 5.9 · Golden compositions are composed in UTC

The 60 committed compositions were built once, in UTC, so a golden punch card reads "peaks at 23:00 UTC" for every viewer, while decision 22 puts Heatmap hours and Timeline days in the viewer's zone.

- Assumed: acceptable for GATE 3. In Phase 6 the route can recompose the zone-dependent templates (punch-card, merged-recent) from the sample with the viewer's zone, still with zero GitHub calls, and fill only when the zone is not UTC.
- Check: whether that is the right fix, or golden answers should stay fixed in UTC and say so.

## 5.4 · The number check proves a figure is in the data, not that it is the right one

A fill sentence can pass by quoting a real figure in the wrong frame: the first merged-recent draft said "84 pull requests merged this week, from 27 contributors", where 27 is the 90-day count. The template now cites only what its window supports, but the general risk stays.

- Assumed: Phase 7's bindings scorer, which compares each figure to the measure and window it claims, is where this is measured; the fill prompt already says to use only the figures listed for each sentence.
- Check: nothing now; read the GATE 3 compositions with this in mind.

## 6.6 and 6.7 · The force flags work in production too

`prompts/06-shell.md` calls `?force=warming`, `?force=ratelimit`, `?force=cap` and `?force=empty` dev flags. The Playwright suite runs against a production build, so the flags have to work there.

- Assumed: they stay on in production. None of them spends anything or reads GitHub: warming and rate limit are synthetic, cap answers only from golden and cached answers, and empty composes a committed fixture with no model call.
- Check: whether to hide them behind an environment variable before launch.

## 6.8 · A follow-up click on a sample calls Haiku

Golden answers on samples cost nothing, but a click on a piece asks a follow-up (`from` is set), which goes through the classifier and the fill on the sample's data: about 6s and a fraction of a cent, counted against the visitor's 15. The answer is then kept in the answer cache, so the next visitor's identical click replays it.

- Assumed: acceptable. Precomputing the default follow-ups of the 60 golden compositions would make every first click instant, at the cost of a larger `golden/` directory.
- Check: whether to precompute them.

## 6.12 · Footer wording

The screen references print "Public repos only · nothing is stored beyond a cache of GitHub's public stats · no account needed"; `docs/decisions.md` says the footer is "Nothing you paste is stored. Public repos only. Sample data is marked."

- Assumed: the decision wins, per `design-system/screens/README.md` (docs win over a screen's wording). Sample data is marked by a `sample · read <day>` chip in the eyebrow and "read the sample" in the strip.
- Check: nothing unless the wording should change.

## 6.7 · Small gaps left open after the shell

- The near-empty fixture (`packages/composer/fixtures/near-empty/vercel-labs__vercel-byoc.json`, recorded by `pnpm --filter @genui-github/composer near-empty:refresh`) has no `stats/contributors`: GitHub answered 202 for half an hour. Under `?force=empty`, the questions that read it show the warming state. Check: rerun the recorder once GitHub has counted.
- Under `?force=empty` the eyebrow shows the repo in the URL, since the stream carries no repo name. Open `/r/vercel-labs/vercel-byoc?q=…&force=empty` to read it right. A response header naming the repo would fix it for good.
- A LineChart with tiny values repeats y-axis labels (0.2, 0.2, 0.1, 0.1, 0), seen on the near-empty CI chart. Assumed: a component fix for the final audit; it shows only on repos with almost no CI.
- A SystemScreen is swapped for the answer outright when Try again succeeds, so its exit never plays.
- A server-rendered Renderer under reduced motion fails hydration (the server draws the rise offset, the client a fade). The composed screen is unaffected because its tree arrives after hydration; the landing preview mounts its Renderer in the browser only. The fix belongs in `PieceFrame`.
- `--hero-type-min` and `--hero-type` (32 to 52px) are unused: the landing sentence matches the reference at 1440 with the question's clamp (44px).
- Copy written by the build for the owner to read: the landing's group lines and returning offer ("Pick up where you left off"), the how-this-works steps, the drawer's route sentence, and the rate-limit and daily-cap body copy. The rate-limit screen leaves out the reference's "GitHub answered 403" and "0 of 5,000 requests left", since the refusal does not carry them.

## 7.1 · Six expectations in the set followed the data

The first full production run scored a few cases against expectations written before the samples were read:

- `golden-02-tailwindcss` and `golden-02-vite` expected Failing checks hot; both samples have zero failing checks, and a zero blocks nothing. They now expect only Awaiting review hot.
- `golden-03-nextjs`, `-react` and `-vite` expected Bus factor hot; it is hot only when one person carries the repo (tailwindcss and claude-code). They now expect none.
- `follow-02-pull-row` expected a StatusList of checks in pr-detail; under 5.3b's assumption it is a KeyValue of the pull request's facts.
- Assumed: an expectation describes what the composer should do given the data, so these are corrections, not a lowered bar. No scorer was loosened to pass a case; the scorer fixes (a count of a total compares by its count, a clock compares by its hour, a piece in an honest empty or warming state over missing data passes, a windowed metric is checked against the same measure over its window, hot is scored only where the case names it) each make a right answer read as right.
- Check: that these six read right to you.

## 7.1 · Rule 5 now drops the words, not the metric

The eval found the contributors template on tailwindcss losing its hot Bus factor metric because the fill's delta ("Single point of failure") repeated the ContributorRank band. Rule 5 now strips the delta and keeps the metric and its number; the drop is still recorded, so the rules scorer still counts it.

- Check: nothing, unless a repeated word should cost the whole metric.

## 7.2 · The composer's off-template path did not stream

`compose()` collected every off-template piece and sent them only after Sonnet finished, so the first piece arrived with the last. It now yields each piece as soon as it passes the rules.

## 7.3 · The results page draws its latency chart itself

The catalog's Distribution has a minutes-to-days scale with pull request and issue wording, so composition times (3 to 12 s) would all land in "under 1h". The page draws the same look on a seconds scale in `apps/web/src/evals/Latency.tsx`. Metric and Comparison accept only repo measure ids and have no dollar unit, so the page keys them with its own ids and shows cost per 10,000 answers in whole dollars.

- Assumed: page-level is fine for an internal results page. The reference's per-question grid, the "how an answer is scored" card and the pass-rate trend across runs are not built: they predate `docs/evals.md` and the trend needs more than one baseline.
- Check: whether Distribution should take a seconds scale (a `packages/ui` change) so the page can use the real component.

## 7.4 · Ten bindings in the set named pieces the templates do not draw

Release blockers draws the milestone metrics only with a dated milestone (vite has one; its open-PR metric is then scoped to it), and month compare's second metric is the failing run rate, not review wait. The set now expects what the templates draw. The bindings scorer then became strict: an expected piece missing from the screen fails, which is what lets the gate catch a template that binds the wrong scope.

- Check: whether month compare should show review wait as `docs/golden-questions.md` implies ("Metric ×2 with trend") instead.

## 7.2 · Haiku could compose off-template

On the baseline, the `haiku` run (Haiku composing the off-template questions) matched production on every scorer at a third of the cost, but the off-template cases carry no component or binding expectations, so the set does not measure how good a free composition is.

- Assumed: production keeps Sonnet off-template, as `docs/decisions.md` says.
- Check: whether to add expectations to the 10 off-template cases (or a judge) so the two can be compared on quality, then decide.

## 7.2 · A template answer's first piece arrives with its last

The fill rewrites the prose of a template composition before anything streams, so the first piece lands at about 6 s with the rest. Streaming the bound pieces first and sending the filled prose as `update` ops would put the first piece under 1 s on a cached sample.

- Check: whether to do that (it changes how the insight arrives: system words first, then the filled sentence).

## 8.4 · Trying the MCP App in Claude Desktop (owner)

Build the frame once, then add the server to Claude Desktop's config (`~/Library/Application Support/Claude/claude_desktop_config.json`) and restart Claude Desktop:

```
pnpm --filter @genui-github/mcp-app build
```

```json
{
  "mcpServers": {
    "generative-ui-github": {
      "command": "/usr/local/bin/node",
      "args": [
        "/Users/brandonchurch/generative-ui-github/apps/mcp-app/node_modules/tsx/dist/cli.mjs",
        "/Users/brandonchurch/generative-ui-github/apps/mcp-app/src/main.ts",
        "--stdio"
      ],
      "env": { "GENUI_APP_URL": "http://localhost:3217" }
    }
  }
}
```

The server reads `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` from `.env.local` at the repo root, so the config carries no secrets. Then ask "show me the health of vercel/next.js": Claude should call `compose` and the answer should draw in the pane. Golden questions on the five samples answer with no model call; anything else calls Haiku, counted against the 15 a day. `GENUI_APP_URL` is where "Open in Generative UI" goes; it points at the dev server on 3217 until the app is deployed.

- Assumed: Claude Desktop renders MCP Apps for local stdio servers. If it shows only text, the server is fine (the Inspector run in `docs/status.md` shows the UI metadata); the host needs MCP Apps support switched on.
- Check: the answer draws in the pane, a click on a metric asks the follow-up in the chat, and "Open in Generative UI" opens the full screen.

## 9.0 · Dark theme skipped

`design-system/tokens.json` has no dark values yet, so 9.0 was skipped as the plan says. `docs/dark-theme-brief.md` is with the owner for design (final audit A.4). `scripts/tokens-build.mjs` already emits the `[data-theme="dark"]` and `prefers-color-scheme` blocks once `{ light, dark }` values are in.

- Check: run 9.0 when the values land.

## 9.6 · The README's cost figures are measured, not the launch doc's

`docs/launch.md` asks the thesis to quote "200k tokens per page for full generation vs under a second and ~40 output tokens here". Nothing in the repo measures those: the brief says "minutes per page, hundreds of thousands of tokens" for full generation, and the eval run measured this project's live template answers at a median of 2,548 tokens (904 output), $0.0019 and 6.1 s p50, with golden answers in 2 ms and no model call. The README quotes the measured figures.

- Check: whether to keep the measured figures, or source the launch doc's (and cut the fill's output so ~40 tokens becomes true).

## 9.6 · Things the README surfaced

- `packages/ui` and `packages/renderer` are `"private": true`, so the README's install section describes packages not yet published. Phase 10.2 prepares the tarballs; publishing is the owner's.
- The README's architecture diagram is drawn from the five-step flow in `design-system/screens/About.html`; the brief has the four-layers table (copied as is) but no diagram.
