import { existsSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { composeDeps } from '@genui-github/composer'
import { createLogger, logToStderr } from '@genui-github/core'
import { createServer, readView, type AppOptions } from './server'

// `tsx src/main.ts --stdio` (or MCP_TRANSPORT=stdio) for Claude Desktop and other local hosts; without it, Streamable HTTP on
// PORT (default 3240) at /mcp, stateless, a fresh server per request.

const stdio = process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio'
// Over stdio, stdout is the protocol: every log line, info and debug included, goes to stderr.
if (stdio) logToStderr()

const root = fileURLToPath(new URL('../../../', import.meta.url))
// The token and the key stay in .env.local at the repo root, read at runtime; a host's env wins.
if (existsSync(`${root}.env.local`)) process.loadEnvFile(`${root}.env.local`)

const log = createLogger('mcp-app')
const options: AppOptions = {
  deps: () => composeDeps(),
  html: readView(fileURLToPath(new URL('../dist/view.html', import.meta.url))),
  appUrl: process.env.GENUI_APP_URL ?? 'http://localhost:3000',
}

if (stdio) {
  await createServer(options).connect(new StdioServerTransport())
} else {
  const port = Number(process.env.PORT ?? 3240)
  createHttpServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      res.writeHead(404).end()
      return
    }
    const server = createServer(options)
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      log.error('request failed', { error: (error as Error).message })
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }))
    }
  }).listen(port, () => log.info('listening', { url: `http://localhost:${port}/mcp` }))
}
