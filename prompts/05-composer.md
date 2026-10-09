# Phase 5 · Composer

Read `CLAUDE.md`, `docs/plan.md` Phase 5, `docs/composer.md` (all of it), `docs/golden-questions.md` (all of it), `docs/evals.md` section The set (for 5.0), `docs/schemas.md` section Registry prompt, `docs/decisions.md` section Model routing.

Confirm `.env.local` has `ANTHROPIC_API_KEY`. Author the eval set first (5.0): it is data, and the classifier and off-template tests use it. Then the Anthropic client with caching and cost accounting, the classifier, all 15 templates as deterministic modules, the prose fill, off-template composition, the rules in code, the route with the limits and the cap, and the built payload.

Every template must produce a valid tree from every sample repo with no model call; test that before touching the fill step. After the route works, run `pnpm compositions:refresh` (5.9) so the 60 golden compositions are committed and the zero-call path is real. The fill step's test is 100 runs with zero unvalidated numbers reaching the tree; if a number slips through, fix the validator, not the prompt.

The route serves golden questions on sample repos from cache with zero model calls; assert that with the Anthropic client mocked. Commit, write `docs/status.md`, stop at GATE 3.
