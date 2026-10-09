# Phase 9 · Dark theme, hardening, cost controls

Read `CLAUDE.md`, `docs/plan.md` Phase 9, `docs/decisions.md` section Model routing, `docs/00-brief.md`, `docs/launch.md` section README.

If `design-system/tokens.json` has a dark theme, do 9.0 first: `pnpm tokens:build`, check every component in dark on `/catalog`, run `pnpm a11y` in dark. If not, skip 9.0, note it, and continue. Then error boundaries, the health route, the two load scripts with `DAILY_CAP_USD=0.50` in the test env, the secrets check, Lighthouse, and the root README. Continue straight into Phase 10.
