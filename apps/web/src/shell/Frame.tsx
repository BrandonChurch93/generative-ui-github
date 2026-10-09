import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Density } from '@genui-github/ui'
import styles from './Frame.module.css'

/** The whole privacy policy (docs/decisions.md, Product). */
export const FOOTER_LINE = 'Nothing you paste is stored. Public repos only. Sample data is marked.'

export const GITHUB_URL = 'https://github.com/BrandonChurch93/generative-ui-github'

export const PORTFOLIO_URL = 'https://brandonchurchportfolio.com'

type Section = 'catalog' | 'evals' | 'about'

const LINKS: { href: string; label: string; section: Section }[] = [
  { href: '/catalog', label: 'Catalog', section: 'catalog' },
  { href: '/evals', label: 'Evals', section: 'evals' },
  { href: '/about', label: 'About', section: 'about' },
]

export function ExternalArrow() {
  return (
    <svg className={styles.ext} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8L8 4" />
      <path d="M4.5 4H8V7.5" />
    </svg>
  )
}

export function SiteHeader({ current }: { current?: Section }) {
  return (
    <header className={styles.wrap}>
      <div className={styles.top}>
        <Link className={styles.wordmark} href="/">
          Generative UI
        </Link>
        <nav className={styles.nav} aria-label="Site">
          {LINKS.map(link => (
            <Link key={link.href} href={link.href} aria-current={current === link.section ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
          <a href={GITHUB_URL} rel="noreferrer">
            GitHub
            <ExternalArrow />
            <span className="sr-only">, opens GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  )
}

/** A link that opens in a new tab and says so to a screen reader. */
export function OutLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalArrow />
      <span className="sr-only">, opens in a new tab</span>
    </a>
  )
}

export function SiteFooter() {
  return (
    <footer className={`${styles.wrap} ${styles.footer}`}>
      <p className={styles.foot} data-footer="">
        {FOOTER_LINE}
      </p>
      <p className={styles.credits}>
        <OutLink href={PORTFOLIO_URL}>Built by Brandon Church</OutLink>
        <span aria-hidden="true">·</span>
        <OutLink href={GITHUB_URL}>Source on GitHub</OutLink>
      </p>
    </footer>
  )
}

/**
 * Every page: top bar, main, footer. `tray` reserves room at the foot for the fixed ask tray; `density` is the
 * screen root's, which every card and row reads.
 */
export function Frame({ children, current, density, tray, inert }: { children: ReactNode; current?: Section; density?: Density; tray?: boolean; inert?: boolean }) {
  return (
    <div className={styles.page} data-density={density ?? 'comfortable'} data-tray={tray ? '' : undefined} inert={inert || undefined}>
      <SiteHeader current={current} />
      <main className={`${styles.wrap} ${styles.main}`} id="main">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export const frameStyles = styles
