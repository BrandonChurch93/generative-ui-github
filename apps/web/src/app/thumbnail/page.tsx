import type { Metadata } from 'next'
import { goldenComposition, TEMPLATE_NEEDS } from '@genui-github/composer'
import { Thumbnail } from '../../thumbnail/Thumbnail'

// The source of the portfolio thumbnail and the Open Graph image (`pnpm thumbnails`). Linked from nowhere.
export const metadata: Metadata = { title: 'Thumbnail', robots: { index: false, follow: false } }

const REPO = { owner: 'vercel', name: 'next.js' }

export default async function ThumbnailPage({ searchParams }: { searchParams: Promise<{ size?: string | string[] }> }) {
  const { size } = await searchParams
  const composition = goldenComposition(REPO, TEMPLATE_NEEDS['release-blockers'].question)
  return <Thumbnail size={size === 'og' ? 'og' : 'portfolio'} composition={composition ?? null} />
}
