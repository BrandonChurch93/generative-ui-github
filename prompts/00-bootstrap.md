# Phase 0 · Scaffold and tooling

Read `CLAUDE.md`, then `docs/plan.md` Phase 0, then `docs/decisions.md` sections Stack, Model routing and Commits.

Build the monorepo exactly as `CLAUDE.md` lays it out. Empty packages are fine; the point is that install, typecheck, lint, test, e2e, a11y and lighthouse all run. `scripts/tokens-build.mjs` already exists; wire it as `pnpm tokens:build` and confirm it reproduces the committed `design-system/tokens.css`. Load the fonts through `next/font`. Import `tokens.css` globally. Put the model ids and the current prices from docs.claude.com into the price table with today's date. If `GITHUB_TOKEN` or `ANTHROPIC_API_KEY` is missing, `/` renders a config error state in the system's words, not a crash.

Tick each 0.x box as its done criterion passes. Commit locally. Write `docs/status.md`. Stop at GATE 0.
