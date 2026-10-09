import { readFile } from 'node:fs/promises'
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import { McpServer, type CallToolResult, type ReadResourceResult } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { compose, visitorKey, type ComposeDeps } from '@genui-github/composer'
import type { WarmingStatus } from '@genui-github/data'
import { collect, FRAME_WIDTH, framed, modelText, openUrl } from './frame'

// The MCP App (MCP Apps 2026-01-26, extension io.modelcontextprotocol/ui): one tool the model calls,
// `compose(repo, question)`, tied to one UI resource that draws the answer in the host's frame. The model
// reads the answer as text; the frame reads the composition from `structuredContent`.

export const RESOURCE_URI = 'ui://genui-github/compose.html'

export interface AppOptions {
  /** The composer's dependencies: the route's, made from the environment. */
  deps: () => Promise<Omit<ComposeDeps, 'visitor'>>
  /** The bundled view, one HTML file. */
  html: () => Promise<string>
  /** The web app the frame links out to for the full screen. */
  appUrl: string
}

const input = {
  repo: z.string().min(1).max(300).describe('A public GitHub repo: owner/name or a github.com URL'),
  question: z.string().min(1).max(300).describe("The reader's question about it, as they asked it"),
}

/** The structured result the frame renders. */
export type FrameResult =
  | { kind: 'composition'; repo: string; question: string; url: string; composition: ReturnType<typeof framed>; warming?: WarmingStatus }
  | { kind: 'refused'; repo: string; question: string; url: string; message: string; resetAt?: string }

/** Runs the composer for a question and shapes the result for the model and the frame. */
export async function answer(options: AppOptions, args: { repo: string; question: string; warming?: WarmingStatus }): Promise<CallToolResult> {
  const deps = await options.deps()
  const url = openUrl(options.appUrl, args.repo, args.question)
  const outcome = await compose(
    { repo: args.repo, question: args.question, frameWidth: FRAME_WIDTH },
    { ...deps, visitor: visitorKey('mcp-app', 'io.modelcontextprotocol/ui'), warming: args.warming ?? null },
  )
  if (outcome.kind === 'refused') {
    const result: FrameResult = { kind: 'refused', repo: args.repo, question: args.question, url, message: outcome.refusal.message, ...('resetAt' in outcome.refusal && outcome.refusal.resetAt ? { resetAt: outcome.refusal.resetAt } : {}) }
    return { content: [{ type: 'text', text: outcome.refusal.message }], structuredContent: result }
  }
  const collected = await collect(outcome.ops)
  if ('error' in collected) {
    const result: FrameResult = { kind: 'refused', repo: args.repo, question: args.question, url, message: collected.error }
    return { content: [{ type: 'text', text: collected.error }], structuredContent: result, isError: true }
  }
  const composition = framed(collected.composition)
  const warmingPiece = composition.regions.main.find(p => p.component === 'WarmingUp')
  const result: FrameResult = { kind: 'composition', repo: args.repo, question: args.question, url, composition, ...(warmingPiece ? { warming: warmingPiece.bound as WarmingStatus } : {}) }
  return { content: [{ type: 'text', text: modelText(composition, args.repo, url) }], structuredContent: result }
}

export function createServer(options: AppOptions): McpServer {
  const server = new McpServer({ name: 'Generative UI for GitHub Repos', version: '0.1.0' })

  registerAppTool(
    server,
    'compose',
    {
      title: 'Compose an answer about a GitHub repo',
      description:
        "Answers a question about a public GitHub repo with an interface composed from the repo's live data: pull requests, checks, contributors, CI, issues and releases. Use it for questions such as what is blocking a release, who carries a repo, or whether CI is getting slower.",
      inputSchema: z.object(input),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async args => answer(options, args),
  )

  // While GitHub counts a repo's statistics, the frame asks again on the warming schedule. The model never sees it.
  registerAppTool(
    server,
    'compose-check',
    {
      title: 'Check again while GitHub counts',
      description: 'Asks again for an answer whose statistics GitHub was still counting.',
      inputSchema: z.object({ ...input, warming: z.unknown() }),
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } },
    },
    async args => answer(options, { repo: args.repo, question: args.question, warming: args.warming as WarmingStatus }),
  )

  registerAppResource(
    server,
    'Generative UI answer',
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE, description: 'The composed answer, drawn by the Generative UI renderer.' },
    async (): Promise<ReadResourceResult> => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await options.html(),
          // The two faces load from Google Fonts; nothing else leaves the frame.
          _meta: { ui: { csp: { resourceDomains: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'] }, prefersBorder: false } },
        },
      ],
    }),
  )

  return server
}

export const readView = (path: string) => () => readFile(path, 'utf8')
