# @genui-github/ui

The component catalog behind Generative UI for GitHub Repos. Each piece (Metric, StatusList, Insight, LineChart, ContributorRank, Heatmap, ActionCard and the rest) ships five states (default, skeleton, empty, error, warming), three densities, a Zod schema with a one-line note on when to choose it, and its own choreography. The registry turns the catalog into the prompt a model composes from.

Use it on its own to render pieces, or with `@genui-github/renderer` to render whole compositions.

## Install

```sh
npm install @genui-github/ui react react-dom
```

React 19. Load Plus Jakarta Sans (400 to 700) and JetBrains Mono (400, 500), for example from Google Fonts. Every color, size and space comes from the tokens in `styles.css`; set `font-family: var(--font-sans)` on the page so a piece on its own picks up the house face.

## Usage

```tsx
import { createRoot } from 'react-dom/client'
import { registry } from '@genui-github/ui'
import { PIECES } from '@genui-github/ui/pieces'
import '@genui-github/ui/styles.css'

const { Component: Metric } = PIECES.Metric!

// The model's choices validate against the schema; the system binds the data.
const choice = { measure: 'failing-checks', label: 'Failing checks', delta: 'both on canary', deltaTone: 'crit', hot: true }
console.assert(registry.get('Metric')!.schema.safeParse(choice).success)
const bound = { ...choice, value: 2, suffix: 'of 14', format: 'count' }

function App() {
  return (
    <div data-density="comfortable">
      <Metric props={bound} state="default" ask="Which checks are failing?" onAsk={ask => console.info(ask)} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
```

Density comes from `data-density` on an ancestor: `compact`, `comfortable` or `spacious`.

## Entry points

- `@genui-github/ui`: shared parts, the registry, tokens, types and number validation.
- `@genui-github/ui/pieces`: every component with its choreography, by name.
- `@genui-github/ui/motion`: the six moves and the card rise, as GSAP timelines.
- `@genui-github/ui/registry`: the registry alone, with no React, for a server.
- `@genui-github/ui/styles.css`: tokens, shared rules and every component's styles.

## License

MIT
