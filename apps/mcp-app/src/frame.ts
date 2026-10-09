import { createStreamParser, toComposition, type Composition, type Piece, type StreamOp } from '@genui-github/renderer/core'

// What the MCP App frame shows (design-system/screens/MCPApp.html, Anatomy): the insight, two metrics and the
// main list, at compact density. Charts and the action card stay on the full screen, one link away.

/** The design width the composer is told about, and the floor the frame still reads at (decision 53). */
export const FRAME_WIDTH = 420
export const FRAME_FLOOR = 360

/** The composition, cut to what a 420px frame carries. */
export function framed(composition: Composition): Composition {
  const { regions } = composition
  return {
    ...composition,
    density: 'compact',
    asks: [],
    regions: { insight: regions.insight, metrics: regions.metrics.slice(0, 2), main: regions.main.slice(0, 1), side: [], action: [] },
  }
}

/** The full screen for the same question, where the drawer, the charts and the tray are. */
export function openUrl(appUrl: string, repo: string, question: string): string {
  return `${appUrl.replace(/\/$/, '')}/r/${repo}?q=${encodeURIComponent(question)}`
}

const insightSentence = (pieces: Piece[]): string | undefined => {
  const bound = pieces[0]?.bound as { sentence?: unknown } | undefined
  return typeof bound?.sentence === 'string' ? bound.sentence.replace(/`/g, '') : undefined
}

/** What the model reads: the answer in the system's words, and where the rest is. The view gets the composition. */
export function modelText(composition: Composition, repo: string, url: string): string {
  const said = insightSentence(composition.regions.insight)
  const names = [...new Set(Object.values(composition.regions).flat().map(p => p.component))]
  return [said ?? `Composed an answer for ${repo}.`, `Shown: ${names.join(', ')}.`, `Full screen: ${url}`].join('\n')
}

/** Reads the composer's stream to its finished composition, or the reason it has none. */
export async function collect(ops: AsyncIterable<StreamOp>): Promise<{ composition: Composition } | { error: string }> {
  const parser = createStreamParser({ log: { warn: () => {} } })
  for await (const op of ops) parser.push(`${JSON.stringify(op)}\n`)
  const tree = parser.end()
  const composition = toComposition(tree)
  return composition ? { composition } : { error: tree.error ?? "Couldn't write an answer to this question." }
}
