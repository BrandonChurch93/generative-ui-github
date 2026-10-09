# Generative UI for GitHub Repos

Paste a public GitHub repo, ask it a question, and an agent composes an interface around that repo's data, live, from a hand-built component catalog.

> Demo: coming · [docs/demo.gif](docs/demo.gif) (placeholder; the owner replaces this line when the video is recorded)

## Model decides, code renders

Full-page generation is slow and expensive: minutes per page and hundreds of thousands of tokens (`docs/00-brief.md`). Here the model never writes HTML, CSS or a color. It picks components from a catalog and passes structured arguments, and code draws every piece. A golden question on one of the five sample repos is served from a precomputed composition with no model call (2 ms in a production build). A live question is one Haiku classification and one Haiku fill: in the 2026-10-09 eval run the median live template answer used 2,548 tokens, 904 of them output, the whole set cost $0.0019 per answer, and answers finished at 6.1 s p50. That latency is still above the composer's targets because the fill runs before anything streams. Because the model only chooses, the catalog is the product: 21 designed components plus code-first primitives, each with five states, three densities, a Zod schema and its own motion. When a new answer replaces the old one, the screen rewrites in place: exits reverse entrances and pieces that survive morph instead of remounting.

## Architecture

```
  repo + question
        │
        ▼
  GitHub API          public REST and GraphQL reads · cached · "warming" while /stats computes
        │ normalized repo data
        ▼
  Composer            model decides
        │ router (Haiku): one of 15 templates, or off-template
        ├── template path: Haiku fills the prose slots of a fixed layout
        └── off-template:  Sonnet composes freely from the registry
        │
        ▼
  JSON composition    meaning only: component, props, tone, emphasis, density
        │ A2UI adapter both ways
        ▼
  Renderer            code renders
        │ validates each piece against its Zod schema · diffs by stable id · streams JSONL
        ▼
  Component catalog + design tokens
        │
        ├── Web app   apps/web
        └── MCP App   apps/mcp-app
```

The four layers, from the brief:

| Layer | What it is | Package |
| --- | --- | --- |
| Component catalog | 21 designed components plus the code-first primitives. Each ships a Zod schema, five states, three densities, motion, and a sample JSON | `packages/ui` |
| Renderer | Takes a UI description, validates against the registry, diffs against the current tree so pieces morph instead of remount, streams pieces in as they arrive. A2UI adapter both ways | `packages/renderer` |
| Composer | Takes intent plus normalized repo data, returns a streaming UI description. Haiku picks a template; Sonnet composes off-template. Never writes HTML | `packages/composer` |
| Eval harness | Scores the composer on component choice, data binding, schema validity, latency and cost, across models. Results page in the app | `packages/evals` |

Numbers the model writes into prose are checked against the data they cite. A number that does not match is replaced by a system sentence. A malformed piece renders its error state with a logged reason; the renderer never throws on model output.

## The twelve questions

Each is a layout template and a row in the eval set. The landing page chips use these words.

| # | Question | Template |
| --- | --- | --- |
| 1 | How's this repo doing? | `overview` |
| 2 | What's blocking the next release? | `release-blockers` |
| 3 | Who's carrying this repo? | `contributors` |
| 4 | Is CI getting slower? | `ci-trend` |
| 5 | What's been merged this week? | `merged-recent` |
| 6 | Which issues have gone stale? | `stale-issues` |
| 7 | Show me the biggest open PR | `biggest-pr` |
| 8 | Where would a new contributor start? | `new-contributor` |
| 9 | How responsive are the maintainers? | `responsiveness` |
| 10 | Compare this month to last | `month-compare` |
| 11 | When does this project get worked on? | `punch-card` |
| 12 | What changed between the last two releases? | `release-diff` |

Clicking a piece asks a follow-up. Three more templates answer those (`check-failures`, `pr-detail`, `person`), 15 in all. Anything else goes off-template to Sonnet. The full table, with the components each template uses, is in `docs/golden-questions.md`.

## Run it

Node 22.12 or later · pnpm 10 (`corepack enable` picks up the pinned version).

Create `.env.local` at the repo root. It is gitignored; never commit it.

```sh
# Fine-grained personal access token · public repositories · read-only
GITHUB_TOKEN=
# Server side only
ANTHROPIC_API_KEY=
# Optional · daily spend cap in USD; when reached the site serves cached answers only
DAILY_CAP_USD=5
# Optional in dev (counters and cache stay in memory) · required in production
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

```sh
pnpm install
pnpm dev
```

Next.js prints the local URL. Then:

- `/` · paste a repo or pick a sample, ask a question
- `/catalog` · every component in every state and density, drawn from its `sample.json`
- `/evals` · the latest eval results

Other scripts:

```sh
pnpm test          # render and schema tests
pnpm lint          # ESLint, the copy rules and the CSS token check
pnpm e2e           # Playwright
pnpm evals:run --model production --runs 3   # calls the Anthropic API and spends money
pnpm evals:check   # reruns the 60 golden cases and fails on a regression
```

## Use the packages

The renderer and the catalog are MIT packages under the `@genui-github` scope.

```sh
npm install @genui-github/renderer @genui-github/ui react react-dom
```

React 19. Load Plus Jakarta Sans (400 to 700) and JetBrains Mono (400, 500), for example from Google Fonts.

```tsx
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Renderer, type Composition } from '@genui-github/renderer'
import releaseBlockers from '@genui-github/renderer/fixtures/1-release-blockers.json'
import checkFailures from '@genui-github/renderer/fixtures/2-check-failures.json'
import '@genui-github/ui/styles.css'
import '@genui-github/renderer/styles.css'

function App() {
  const [composition, setComposition] = useState(releaseBlockers as Composition)
  // A click on a piece arrives as a question. Swapping in the answer rewrites the
  // screen in place: pieces that keep their id morph instead of remounting.
  const onAsk = () => setComposition(checkFailures as Composition)
  return <Renderer composition={composition} question="What's blocking the next release?" onAsk={onAsk} />
}

createRoot(document.getElementById('root')!).render(<App />)
```

To render a stream, feed each JSONL line to `createStreamParser()` and pass its tree: `<Renderer tree={parser.push(chunk)} />`. The package also exports the format as Zod schemas, `diff(prev, next)`, and `toA2UI` / `fromA2UI`. See `packages/renderer/README.md` and `packages/ui/README.md`.

## MCP App

`apps/mcp-app` exposes one tool, `compose(repo, question)`, and draws the answer in a 420px frame inside a chat host that supports MCP Apps. It runs over stdio, or Streamable HTTP on port 3240 at `/mcp`. It reads the same `.env.local`, so the host config carries no secrets.

```sh
pnpm --filter @genui-github/mcp-app build
```

Claude Desktop setup is in `docs/questions.md`, entry 8.4.

## Eval results

Baseline from 2026-10-09: 99 cases × 3 runs per model. Every model composed 291 and refused the 6 it should (private and missing repos), with no failures. `production` is the shipped routing (Haiku classifies and fills, Sonnet off-template); `sonnet` composes everything with Sonnet; `haiku` composes everything with Haiku.

| Scorer | production | sonnet | haiku |
| --- | --- | --- | --- |
| template | 0.96 | 0.13 | 0.96 (0.96 to 0.97) |
| components (mean F1) | 1.00 (0.993) | 0.27 (0.749) | 1.00 (0.993) |
| hot | 1.00 | 0.33 | 1.00 |
| schema | 1.00 | 0.91 | 0.997 |
| bindings | 1.00 | 0.35 | 1.00 |
| numbers | 1.00 | 1.00 | 1.00 |
| rules | 1.00 | 0.95 | 1.00 |
| done p50 / p90 | 6.1 s / 8.4 s | 4.7 s / 6.6 s | 6.0 s / 8.6 s |
| first piece p50 | 6.1 s | 2.6 s | 6.0 s |
| cost per answer | $0.0019 | $0.0137 | $0.0007 |
| cost for 297 | $0.56 | $3.99 | $0.20 |

Routing to templates costs about a seventh of composing everything with Sonnet, and every template answer binds the right numbers. `haiku` matches `production` here because the two differ only on the off-template cases, which carry no component expectations yet.

The full results are at `/evals` in the app and in `packages/evals/results/`. Reproduce with `pnpm evals:run`.

## What it is not

- No private repos. Public repos only, read through a read-only token on the server; the token never reaches the browser.
- No accounts and no OAuth.
- Nothing you paste is stored. The only visitor state is a last-repo convenience in `localStorage` and a day-scoped rate-limit counter keyed on a hash, gone at midnight UTC.
- ActionCard is sample mode only. It drafts and shows an action; it never writes to GitHub.

## License

MIT. See `LICENSE`.
