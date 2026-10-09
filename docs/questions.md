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
