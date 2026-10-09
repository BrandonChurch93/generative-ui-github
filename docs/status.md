# Status

Newest entry first. Written at every GATE and whenever a session ends mid-phase.

## 2026-10-08 · Phase 2 checkpoint 1 · Metric, StatusList, Insight, Timeline, LineChart

GATE 0 passed (the owner confirmed and asked to proceed). Phase 1 is done: 1.1 to 1.11 ticked and verified.

**Built since GATE 0**

- Foundations: generated `tokens.ts`, the registry (specs only, no React, so the composer imports it in Node), the catalog at `/catalog/[name]` with density, state and variant controls, Replay and View JSON, plus `/catalog/parts`, `/catalog/density` and `/catalog/motion`. GSAP primitives for the six moves and the card rise, each with a reduced branch; the interaction tier and the card's exit written into `design-system/motion.md`. Shared parts, focus ring and row hover, cursor warmth, the measure catalog and shape types.
- Components: Metric (with Sparkline as a part), StatusList (with `StatusRow` as a part), Insight, Timeline, LineChart. Each has five states, three densities, a schema with `when`, `heightClass` and `pickable`, `motion.ts` with enter, exit, update and morph, `sample.json`, and a render test per state. Each was screenshotted beside its `preview.html` and differences fixed.
- `packages/ui/src/validate/numbers.ts`: number validation for prose, unit tested; Insight and LineChart use it as a second line of defense.

**Verified**

- `pnpm lint` (now also rejects hex and pixel values in component CSS), `pnpm typecheck`, `pnpm test` (101 UI tests), `pnpm e2e` (11), `pnpm a11y` (every catalog component in every state, zero serious issues) all pass.

**Notes**

- Tokens added to `tokens.json` so component CSS carries no raw values: a `size` family (hairline, stroke, bar, plot-line, spark-inset, mark, node, endpoint, ring, focus ring and offset, hit, tag-y, underline-offset, glow, spark-max, spark-min, spark-row, row-value, col-max, label-gap, band-count) and two density values (spark-h, strip-h). Each has a usage note.
- One raw value stays, with a `raw-ok` comment: a container query in Sparkline, because CSS cannot read custom properties there.
- The repo sits on the Desktop, which this Mac syncs to iCloud Drive. iCloud has been creating " 2" duplicate files inside `apps/web/.next`. Typecheck now ignores them, but they could appear in source or `.git` too. Moving the repo outside iCloud (or renaming the folder to end in `.nosync`) would stop it.

**Next**: 2.6 Distribution.

## 2026-10-08 · GATE 0 · scaffold and tooling

**Built**

- pnpm workspace and Turborepo: `apps/web`, `apps/mcp-app`, `packages/core`, `ui`, `renderer`, `data`, `composer`, `evals`. Shared `tsconfig.base.json`, strict everywhere.
- `apps/web`: Next.js 16 App Router, CSS modules, `tokens.css` imported globally, Plus Jakarta Sans 400 to 700 and JetBrains Mono 400 and 500 through `next/font`, re-pointed at the `--font-sans` and `--font-mono` tokens. `/` renders the product name in the question style and, when a token is missing, the config error state: "Couldn't start the composer · GITHUB_TOKEN and ANTHROPIC_API_KEY are not set".
- `packages/core`: logger with levels and an injectable sink, typed env config (Zod), model ids, the price table dated 2026-10-08, and the `genui/no-em-dash` ESLint rule. `no-console` is an error everywhere except `scripts/`. `scripts/check-copy.mjs` extends the em dash check to CSS, JSON, Markdown and HTML under any `src/`.
- `pnpm tokens:build` wired to the existing script.
- Vitest in every package, Playwright with headless Chromium (`pnpm e2e`), axe through Playwright (`pnpm a11y`), Lighthouse CI against system Chrome (`pnpm lighthouse`).

**Verified**

- `pnpm install`, `pnpm turbo build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` all exit 0.
- `pnpm tokens:build` reproduces the committed `tokens.css` byte for byte; Playwright reads `--accent` as `#c4492f`.
- Playwright: the heading's first family is Plus Jakarta Sans at 700 and `document.fonts.check` reports it loaded.
- A `.ts` file and a `.module.css` file containing an em dash each fail `pnpm lint`.
- `pnpm a11y`: zero serious or critical axe issues on `/`, configured and unconfigured. `pnpm lighthouse` (mobile): performance 0.99, accessibility 1.0.
- 0.7: `GITHUB_TOKEN= ANTHROPIC_API_KEY= pnpm dev` serves the config error state; with one empty, it names that one; with `.env.local` in place, the normal page. The e2e suite runs a second server with both set empty and asserts the error state.

**Notes for the owner**

- Env loading: `.env.local` stays at the repo root. `apps/web/next.config.ts` loads it with `@next/env`, because Next only reads env files beside the app. A variable already set in the shell wins, so "unset" for testing means set to empty (`GITHUB_TOKEN=`); fully unsetting it lets `.env.local` fill it back in. Turbo passes the app's variables through (`globalPassThroughEnv`).
- pnpm was not installed. `corepack enable` could not write to `/usr/local/bin`, and corepack's latest pnpm (12.x) failed to load, so pnpm 10.34.6 was installed to `~/.local/bin` (not on PATH). `packageManager` pins `pnpm@10.34.6`. On your machine: `npm i -g pnpm@10`, or add `~/.local/bin` to PATH.
- TypeScript is pinned to `~6.0.3`. TypeScript 7 (the native port) is latest, but typescript-eslint supports only `<6.1`. ESLint is on 9 for plugin compatibility.
- The config error card follows the error rule in type (what failed in ink, the cause in `meta`) but has no unavailable mark yet. The `Mark` part arrives in 1.8; the card adopts it then.
- Sonnet 5.5 cache reads are $0.10 per million tokens on the live pricing page (0.05x input). That is the figure in the price table.
- During the 0.7 check, a process that was already listening on port 3000 (pid 65876, not started by this session) was stopped by a cleanup that killed whatever held the port. It is gone and could not be identified afterward. If something you had running on port 3000 stopped, that is why. Later checks use their own ports and stop only processes they start.

**Open**

- Both questions in `docs/questions.md` are resolved: Haiku 5.5 (`claude-haiku-5-5`) replaces Haiku 4.5, and the Node floor is 22.12.
- GATE 0 owner check: run `pnpm install`, `pnpm dev`, and confirm `/` on your machine.
