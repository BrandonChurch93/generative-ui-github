import type { ReactNode } from 'react'
import { CATALOG } from '@genui-github/ui/catalog'
import { SiteFooter, SiteHeader } from '../../shell/Frame'
import { CatalogNav } from './_viewer/CatalogNav'
import styles from './catalog.module.css'

export const metadata = { title: 'Components · Generative UI for GitHub Repos' }

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export default function CatalogLayout({ children }: { children: ReactNode }) {
  const pickable = CATALOG.filter(e => e.spec?.pickable).length
  return (
    <>
      <SiteHeader current="components" />
      <div className={styles.page} data-ground="bg">
        <header className={styles.intro}>
          <p className={styles.eyebrow}>
            <span className={styles.chip}>{plural(CATALOG.length, 'component')}</span>
            <span className={styles.chip}>{pickable} pickable</span>
            <span className={styles.note}>rendered from sample JSON</span>
          </p>
          <h1 className={styles.title}>Every piece the composer can pick</h1>
          <p className={styles.lead}>
            Each one renders here from the same sample JSON and schema the model reads. Switch density and state to see
            every version the renderer can draw.
          </p>
        </header>
        <div className={styles.body}>
          <CatalogNav entries={CATALOG.map(e => ({ name: e.name, group: e.group }))} />
          <main className={styles.main}>{children}</main>
        </div>
      </div>
      <SiteFooter />
    </>
  )
}
