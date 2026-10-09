# Phase 2 · The catalog

Read `CLAUDE.md`, `docs/plan.md` Phase 2, `docs/schemas.md` (all of it), `docs/decisions.md` section Components. For each component, before building it, read `design-system/components/<Name>/README.md`, then build to the prop names in `docs/schemas.md`, then open `preview.html` in Playwright beside your result and compare screenshots.

Build in the plan's order, with the two checkpoints. The data primitives in 2.15a and 2.15b have no preview; check them against their nearest designed sibling. The README is the behavior spec; `docs/schemas.md` is the prop contract; the preview is the reference rendering; the tokens are the only source of values. For each component: the CSS module, the React component, `schema.ts` (Zod, `when`, `heightClass`, `pickable`), `motion.ts` (enter, exit, update, morph composed from the primitives), `sample.json` (anonymized handle-shaped names for people; system-bound values included so the catalog renders without the data layer), and one render test per state. Register it. Check it on `/catalog` at all three densities and all five states before moving on.

Charts share the table view control from `CardFrame`. StatusList has `kind`. Insight accepts a `sources` map prop; the validator in `packages/ui/src/validate/numbers.ts` is unit tested now and wired by the renderer in Phase 3. WarmingUp builds against the `WarmingStatus` type in `docs/schemas.md`.

At each CHECKPOINT: commit, update `docs/status.md`, keep going. When 2.19 passes, commit, write `docs/status.md`, stop at GATE 1. If a session runs out mid-phase, commit what is verified, tick only verified boxes, note where you stopped, and the next session resumes from the plan.
