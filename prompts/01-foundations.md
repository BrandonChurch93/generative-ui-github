# Phase 1 · Foundations in code

Read `CLAUDE.md`, `docs/plan.md` Phase 1, `design-system/README.md` (all of it), `design-system/motion.md`, `design-system/tokens.json`, `docs/schemas.md` sections Shared enums, Measure catalog and Stable ids, and `docs/decisions.md` sections Components and Screens.

Verify the tokens first (1.1); everything after reads from them. Build the registry skeleton (1.3) and then the catalog page shell (1.4) so each later item has a place to be checked. Then density, the motion primitives, the shared parts, focus and hover, cursor warmth, and the measure and shape catalogs as typed ids.

The motion primitives must match `design-system/motion.md` to the millisecond and the easing. Write them so a component's `motion.ts` composes them rather than reimplementing them.

Tick boxes as criteria pass. Commit. Continue straight into Phase 2 without stopping.
