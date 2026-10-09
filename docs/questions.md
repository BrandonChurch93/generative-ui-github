# Questions for the owner

Append only. Each entry: the plan task id, the question, what was assumed, and what to check. The owner answers in place; a resolved entry gets `resolved:` and the answer, and the related decision is added to `docs/decisions.md`.

## 0.5 · Haiku 5.5 is on the price list

The pricing page read on 2026-10-08 lists Claude Haiku 5.5 at $0.10 input and $0.50 output per million tokens (prompts up to 100,000 tokens), a tenth of Haiku 4.5. `docs/decisions.md` names `claude-haiku-4-5-20251001` for classify and fill.

- Assumed: keep Haiku 4.5 as decided. `packages/core/src/models.ts` and `prices.ts` carry only the two decided models.
- Check: whether to move the classifier and prose fill to Haiku 5.5. If yes, add it to the decisions; Phase 5 and the eval runs pick it up from `models.ts`.

## 0.1 · Node version floor

`docs/decisions.md` says Node 20+. Vitest 5 (current) requires Node 22.12 or later, and Next 16 requires 20.9.

- Assumed: root `engines.node` is `>=22.12.0`. This machine runs 22.14.
- Check: that Node 22 or 24 is fine for local work and Vercel. If Node 20 must stay, pin Vitest 4 instead.
