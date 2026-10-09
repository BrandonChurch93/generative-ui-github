import { composeDeps, composeResponse } from '@genui-github/composer'

// Node, not the edge: the composer reads the committed samples and golden compositions from disk.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const deps = await composeDeps()
  return composeResponse(request, () => deps)
}
