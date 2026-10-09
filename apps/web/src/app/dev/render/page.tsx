import { DevRender } from './DevRender'

export const metadata = { title: 'Renderer · Generative UI for GitHub Repos', robots: { index: false } }

export default async function DevRenderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const pick = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined)
  return <DevRender initialFixture={pick('fixture')} initialDensity={pick('density')} reduced={'reduced' in params ? true : undefined} />
}
