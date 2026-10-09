# Project brief

Read once. Everything here is context for why the plan looks the way it does.

## What this is

A portfolio project that proves one thing to a frontier AI lab: that the owner understands the production pattern for generative UI (model decides, code renders, streamed, evaluated) and can build the scarce part, a component catalog beautiful enough that an agent composing from it produces something people want to use.

A visitor pastes a public GitHub repo or picks a sample, asks a question, and a screen streams in piece by piece: the answer sentence first, then the numbers, then the detail. Clicking anything on the screen is a new question, and the screen rewrites itself in place rather than reloading. A "how this was built" drawer shows the decisions, the model, tokens and latency.

## Why it is built this way

- Full-page generation is slow and expensive (minutes per page, hundreds of thousands of tokens). Constrained generation, where the model picks from a catalog and passes structured arguments, costs cents and lands in under a second. The product is therefore the catalog.
- Every other generative UI demo fades the old screen out and the new one in. This one rewrites: exits reverse entrances, survivors morph, nothing remounts. That is the thing a reviewer remembers.
- The GitHub domain means a reviewer can paste a repo they already care about and watch the interface build itself around something personal.
- CHAOSS health metrics (time to first response, closure ratio, bus factor) turn "dashboard" into "insight," and nobody else's demo composes a screen around them.

## Three outputs from one build

1. The hosted app on Vercel. Anyone can use it.
2. The renderer and catalog on npm under MIT. Anyone can install it.
3. An MCP App: the same renderer packaged so "show me the health of vercel/next.js" works inside Claude and ChatGPT.

## The four layers

| Layer | What it is | Package |
| --- | --- | --- |
| Component catalog | 21 designed components plus the code-first primitives. Each ships a Zod schema, five states, three densities, motion, and a sample JSON | `packages/ui` |
| Renderer | Takes a UI description, validates against the registry, diffs against the current tree so pieces morph instead of remount, streams pieces in as they arrive. A2UI adapter both ways | `packages/renderer` |
| Composer | Takes intent plus normalized repo data, returns a streaming UI description. Haiku picks a template; Sonnet composes off-template. Never writes HTML | `packages/composer` |
| Eval harness | Scores the composer on component choice, data binding, schema validity, latency and cost, across models. Results page in the app | `packages/evals` |

## What is already decided

The design system is finished and audited. Every component has a README that is its spec and a preview HTML that is its reference rendering. The decisions that came out of design are in `docs/decisions.md`. The twelve golden questions, which with three follow-ups are the fifteen layout templates, are in `docs/golden-questions.md`. The build has no open design questions; what remains is execution.

## Scope rule

Everything in `docs/plan.md` is v1. Nothing is deferred to "later." The project ships complete or not at all.

## Name

Generative UI for GitHub Repos. Repo slug `generative-ui-github`. npm scope `@genui-github`. The design system file still says "Generative UI" as its name; that is fine, it is the system's name, not the product's.
