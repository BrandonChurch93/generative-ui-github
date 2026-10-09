'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '../catalog.module.css'

const FOUNDATIONS = [
  { href: '/catalog/parts', label: 'Parts' },
  { href: '/catalog/density', label: 'Density' },
  { href: '/catalog/motion', label: 'Motion' },
]

export function CatalogNav({ entries }: { entries: { name: string; group: string }[] }) {
  const pathname = usePathname()
  const groups = [...new Set(entries.map(e => e.group))]
  const item = (href: string, label: string) => (
    <li key={href}>
      <Link href={href} className={styles.navItem} aria-current={pathname === href ? 'page' : undefined}>
        {label}
      </Link>
    </li>
  )
  return (
    <nav className={styles.nav} aria-label="Catalog">
      {groups.map(group => {
        const members = entries.filter(e => e.group === group)
        return (
          <section key={group} className={styles.navGroup} aria-label={group}>
            <p className={styles.navLabel}>
              <span>{group}</span>
              <span>{members.length}</span>
            </p>
            <ul className={styles.navList}>{members.map(e => item(`/catalog/${e.name}`, e.name))}</ul>
          </section>
        )
      })}
      <section className={styles.navGroup} aria-label="Foundations">
        <p className={styles.navLabel}>
          <span>Foundations</span>
          <span>{FOUNDATIONS.length}</span>
        </p>
        <ul className={styles.navList}>{FOUNDATIONS.map(f => item(f.href, f.label))}</ul>
      </section>
    </nav>
  )
}
