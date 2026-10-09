import { composeDeps, health } from '@genui-github/composer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Cache hit rate, model calls and spend today, GitHub rate remaining. Nothing about any visitor. */
export async function GET(): Promise<Response> {
  const deps = await composeDeps()
  return Response.json(await health(deps), { headers: { 'cache-control': 'no-store' } })
}
