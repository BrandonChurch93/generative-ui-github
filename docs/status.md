# Status

Newest entry first. Written at every GATE and whenever a session ends mid-phase.

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

- Two questions in `docs/questions.md`: Haiku 5.5, and the Node floor.
- GATE 0 owner check: run `pnpm install`, `pnpm dev`, and confirm `/` on your machine.
