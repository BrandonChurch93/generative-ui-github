import { notFound } from 'next/navigation'
import { catalogEntry } from '@genui-github/ui/catalog'

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return { title: `${name} · Components · Generative UI for GitHub Repos` }
}

// The gallery in the layout reads the name from the address and opens that card; this page only rejects unknown names.
export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!catalogEntry(name)) notFound()
  return null
}
