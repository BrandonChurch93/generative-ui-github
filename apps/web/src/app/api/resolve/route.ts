import { composeDeps, resolveResponse } from '@genui-github/composer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Whether a typed repo exists and is public: the landing's check before the reader asks it anything. */
export async function GET(request: Request): Promise<Response> {
  return resolveResponse(request, await composeDeps())
}
