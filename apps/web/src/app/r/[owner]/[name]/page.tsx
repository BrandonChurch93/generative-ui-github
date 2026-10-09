import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { canonicalSample, isSample, readSample } from '@genui-github/data/server'
import { ComposedScreen } from '../../../../shell/ComposedScreen'
import { Frame } from '../../../../shell/Frame'
import { day } from '../../../../shell/words'

interface Props {
  params: Promise<{ owner: string; name: string }>
  searchParams: Promise<{ q?: string | string[]; force?: string | string[] }>
}

// A sample's file is megabytes; its date is read once per server instance.
const sampleDays = new Map<string, string | undefined>()
function sampleDayOf(repo: { owner: string; name: string }): string | undefined {
  const key = `${repo.owner}/${repo.name}`.toLowerCase()
  if (!sampleDays.has(key)) {
    let value: string | undefined
    try {
      value = day(readSample(canonicalSample(repo)).refreshedAt)
    } catch {
      value = undefined
    }
    sampleDays.set(key, value)
  }
  return sampleDays.get(key)
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** The overview is the question a bare repo URL asks. */
const DEFAULT_QUESTION = "How's this repo doing?"

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { owner, name } = await params
  const q = first((await searchParams).q)
  return { title: `${q ?? DEFAULT_QUESTION} · ${owner}/${name} · Generative UI` }
}

export default async function RepoPage({ params, searchParams }: Props) {
  const { owner, name } = await params
  const search = await searchParams
  const question = first(search.q)?.slice(0, 300) || DEFAULT_QUESTION
  if (!owner || !name) notFound()
  const repo = { owner: decodeURIComponent(owner), name: decodeURIComponent(name) }
  const sampleDay = isSample(repo) ? sampleDayOf(repo) : undefined
  return (
    <Frame tray>
      <ComposedScreen owner={repo.owner} name={repo.name} question={question} sampleDay={sampleDay} force={first(search.force)} />
    </Frame>
  )
}
