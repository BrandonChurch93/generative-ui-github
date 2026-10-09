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
