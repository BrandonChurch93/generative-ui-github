import Link from 'next/link'
import styles from './gallery.module.css'

const LINKS = [
  { href: '/components', label: 'Components' },
  { href: '/components/parts', label: 'Parts' },
  { href: '/components/density', label: 'Density' },
  { href: '/components/motion', label: 'Motion' },
] as const

/** The way back to the gallery and across to the other foundations, above each foundations page. */
export function Foundations({ current }: { current: (typeof LINKS)[number]['href'] }) {
  return (
    <nav className={styles.crumbs} aria-label="Foundations">
      {LINKS.map(link => (
        <Link key={link.href} href={link.href} className={styles.foundation} aria-current={link.href === current ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
