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
