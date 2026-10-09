import { notFound } from 'next/navigation'
import { catalogEntry } from '@genui-github/ui/catalog'
import { ComponentViewer } from '../_viewer/ComponentViewer'
import styles from '../catalog.module.css'

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return { title: `${name} · Catalog · Generative UI for GitHub Repos` }
}

export default async function ComponentPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ density?: string; state?: string }>
}) {
  const { name } = await params
  const { density, state } = await searchParams
  const entry = catalogEntry(name)
  if (!entry) notFound()
  const schema = entry.spec?.schema
  const shape = schema && 'shape' in schema ? Object.keys((schema as { shape: object }).shape) : []

  return (
    <article className={styles.detail} aria-labelledby="component-name">
      <header className={styles.detailHead}>
        <h2 id="component-name" className={styles.name}>
          {entry.name}
        </h2>
        <p className={styles.description}>{entry.description}</p>
        <p className={styles.facts}>
          {shape.length > 0 && <span className={styles.factLabel}>model sends</span>}
          {shape.map(key => (
            <code key={key} className={styles.chip}>
              {key}
            </code>
          ))}
          {entry.spec?.heightClass && (
            <>
              <span className={styles.factLabel}>height</span>
              <code className={styles.chip}>{entry.spec.heightClass}</code>
            </>
          )}
          {!entry.spec && <code className={styles.chip}>part · never picked</code>}
          {entry.spec && !entry.spec.pickable && <code className={styles.chip}>not pickable</code>}
        </p>
      </header>
      <ComponentViewer name={entry.name} initialDensity={density} initialState={state} />
    </article>
  )
}
