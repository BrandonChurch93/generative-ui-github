# Generative UI for GitHub Repos

Paste a public GitHub repo, ask it a question, and an agent composes an interface around that repo's data, live, from a hand-built component catalog. Model decides, code renders.

This file is read at the start of every session. It holds the rules that never change. Everything else lives in `docs/`. Read `docs/plan.md` next; it is the build checklist and the status board.

## How to work in this repo

- The owner works in long unattended intervals. Do not stop to ask questions that `docs/` already answers. Read `docs/decisions.md` before asking anything; most answers are there.
- Work through `docs/plan.md` top to bottom. Tick a task's box only when its done criterion is met and verified (a test passes, a page renders, a command succeeds). Never tick on intent.
- When a task is done, update `docs/plan.md` in the same commit. The plan file is the single source of status.
- A question only the owner can answer goes in `docs/questions.md` with the task id, what was assumed, and what to check. Then take the most reasonable reading and keep going. Never block on it.
- Stop only at the gates marked `GATE` in `docs/plan.md`. At a gate, write a short summary at the top of `docs/status.md` (what was built, what was verified, what is open) and end the session.
- Commit locally at the end of every task group with a conventional message (`feat(ui): Metric with five states`). Never push. Never commit secrets. Never force anything.
- Before starting a phase, read its prompt in `prompts/`. It names the exact docs for that phase so nothing has to be reread wholesale.

## Rules that never change

**Styling**
- CSS modules plus CSS custom properties. No Tailwind, no CSS-in-JS, no inline style objects for anything a class could carry.
- Every color, size, spacing, radius, shadow and type value comes from `design-system/tokens.css`. No raw hex, no magic pixel values in component CSS. If a value is missing from the tokens, add it to `tokens.json` and regenerate `tokens.css`; do not hard-code it.
- Density is read from `data-density` on the screen root through the `--inset`, `--card-y`, `--row-y`, `--region-gap` and size variables in `tokens.css`. A component never sets its own density.
- One side padding per density for every card and row. Content edges line up down a column.

**Motion**
- Motion (Framer) owns the wrapper: presence (`AnimatePresence`) and layout (`layout` prop, Flip). GSAP owns the guts: what draws, counts, extends or wipes inside a component. Neither touches the other's element.
- Every component ships enter, exit, update and morph in a `motion.ts` next to it. Exit is the strict reverse of enter.
- The six moves plus the card rise, and their timings, are in `design-system/motion.md`. Do not invent an eighth.
- `prefers-reduced-motion` collapses every move to a 200ms opacity change. Counts jump. Cursor warmth is off.

**The model's contract**
- The composer emits a JSON UI description that validates against the Zod registry in `packages/ui/src/registry.ts`. It never emits HTML, CSS, class names, colors, sizes or pixel values.
- The model chooses meaning (`tone`, `emphasis`, `density`, component and props); the system decides what those look like.
- The system writes every state word (tags, verdicts, validation messages, restatements). The model never writes tag text.
- Numbers the model writes into prose (Insight sentences, LineChart, Comparison and Heatmap findings, Metric deltas) are checked against the data they cite. A number that does not match is replaced by a system sentence, never rendered.
- Unknown or malformed components render the component's error state with a logged reason. The renderer never throws on bad model output.

**Components**
- Every component ships five states (default, skeleton, empty, error, warming), three densities, a Zod schema with a one-line "when to choose this" description, a `sample.json`, and `motion.ts`. A state that cannot happen is omitted with a one-line reason in the component README.
- The frame always renders. Card, header and label appear in every state so the reader knows what is loading, missing or failed.
- Error is never `crit`. `crit` is for data that blocks. A failed request uses the unavailable mark and `muted`.
- A zero is data, not empty.
- Text 4.5:1, marks 3:1, visible `focus` ring (2px, 2px offset, the `focus` token, never accent), every interactive card and row a real button or link.

**Copy**
- No em dashes anywhere: code, comments, UI strings, docs, commit messages, tests. Interpuncts (·) separate facts; periods end sentences. A lint rule enforces this in `src/`.
- Labels are sentence case. Nothing is uppercase.
- Error messages say what failed and the cause in plain words ("Couldn't load pull requests · GitHub returned 502"). Never apologize, never say "oops".

**Code**
- TypeScript strict. No `any` without a comment saying why.
- Comments only for a non-obvious WHY someone could otherwise undo. Never narrate what the code does.
- Tests are lean: one render test per component against its `sample.json` in each of the five states, schema validation tests for the composer output, and the eval harness as the real test suite. No unit tests for CSS. No duplicate cases asserting the same output through the same branch. Keep negative cases and regression tests for real bugs.
- No `console.log` left in. Use the logger in `packages/core`.
- Secrets only in `.env.local`, never in code, never in `sample.json`, never in docs.
- The owner places `.env.local` with `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` at GATE 0. If either is missing when Phase 4 starts, stop, write `docs/status.md`, and end the session.

**Data**
- Public repos only, read-only token, server side. The token never reaches the browser.
- GitHub `/stats/*` endpoints can return 202 while GitHub computes. That is the warming state, not an error. Retry with backoff as `docs/data-layer.md` says.
- Sample repos are precomputed and cached. Live repos are cached 15 minutes per repo. The cache key includes the default-branch SHA for stats.
- The catalog page renders from `sample.json` with anonymized, handle-shaped names. The app shows only live API data. Nothing from a `sample.json` ever reaches a composed screen.

**Cost**
- Haiku classifies intent and picks a layout template. Sonnet composes only when no template fits. The registry prompt is cached. 15 live composer calls per visitor per day. A global daily cap flips the site to cached-only mode and says so on screen.

## Layout of the repo

```
apps/web                 Next.js app: landing, composed screen, catalog, evals, about
apps/mcp-app             MCP App server exposing compose(repo, question)
packages/core            logger, config, shared types, no-em-dash lint
packages/ui              the component catalog, registry.ts, tokens
packages/renderer        UI description to React, diff engine, A2UI adapter
packages/data            GitHub fetchers, normalizers, CHAOSS metrics, cache
packages/composer        intent classifier, templates, composition, validation
packages/evals           question set, scorers, runner, results JSON
design-system/           the audited design system: tokens, READMEs, previews
docs/                    plan, decisions, schemas, data-layer, composer, evals, launch
prompts/                 one Claude Code prompt per phase
```

## When something here conflicts with something else

`CLAUDE.md` wins over `docs/`. `docs/decisions.md` wins over `design-system/decisions.md`. `docs/schemas.md` wins over a component README on prop names, enums, limits and on who supplies what (the model names, the system binds); `docs/decisions.md` wins over a README wherever it speaks; the README wins on appearance, states and motion. A README wins over its preview HTML. A preview HTML or a screen HTML is a reference rendering, not production code; build from the README, the schema and the tokens, and use the rendering to check the result.
