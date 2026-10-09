# @genui-github/renderer

Renders a composition from Generative UI for GitHub Repos: a JSON description of a screen that a model composed from the `@genui-github/ui` catalog. The renderer validates every piece against the catalog's schemas, builds the screen as a stream arrives, and animates every change. When a new composition replaces the old one, pieces with the same stable id morph in place instead of remounting: numbers count from old to new, rows slide, cards move with a layout transition.

A piece that fails validation renders its error state with a logged reason. The renderer never throws on bad model output.

## Install

```sh
npm install @genui-github/renderer @genui-github/ui react react-dom
```

React 19. `motion`, `gsap` and `zod` come with the package. Load Plus Jakarta Sans (400 to 700) and JetBrains Mono (400, 500), for example from Google Fonts.

## Usage

```tsx
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Renderer, type Composition, type AskEvent } from '@genui-github/renderer'
import releaseBlockers from '@genui-github/renderer/fixtures/1-release-blockers.json'
import checkFailures from '@genui-github/renderer/fixtures/2-check-failures.json'
import '@genui-github/ui/styles.css'
import '@genui-github/renderer/styles.css'

function App() {
  const [composition, setComposition] = useState(releaseBlockers as Composition)
  // A click on a piece, a day heading, a heatmap cell or a source chip asks a question.
  const onAsk = ({ ask, from }: AskEvent) => {
    console.info(`${from} asked: ${ask}`)
    setComposition(checkFailures as Composition) // a rewrite: survivors morph in place
  }
  return <Renderer composition={composition} question="What's blocking the next release?" onAsk={onAsk} />
}

createRoot(document.getElementById('root')!).render(<App />)
```

To render a composition as it streams, feed each JSONL line to `createStreamParser()` and pass its tree: `<Renderer tree={parser.push(chunk)} />`. The six ops are `start`, `add`, `update`, `remove`, `done` and `error`.

## What else is in the box

- `compositionSchema`, `streamOpSchema` and the types: the format, as Zod schemas.
- `toScreen`, `validatePiece`, `applyRules`: the validation pipeline the composer shares.
- `diff(prev, next)`: exit, enter, morph and keep by stable id.
- `toA2UI` and `fromA2UI`: the composition as A2UI v0.9 messages, and back, losslessly.
- Performance marks `genui:screen:start`, `genui:insight:visible` and `genui:screen:complete` on every screen change.

`prefers-reduced-motion` collapses every move to a 200ms opacity change.

## License

MIT
