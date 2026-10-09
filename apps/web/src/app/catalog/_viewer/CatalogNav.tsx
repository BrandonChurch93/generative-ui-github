'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import styles from '../catalog.module.css'

const FOUNDATIONS = [
  { href: '/catalog/parts', label: 'Parts' },
  { href: '/catalog/density', label: 'Density' },
  { href: '/catalog/motion', label: 'Motion' },
]

const COMPONENT_HREF = /^\/catalog\/[A-Z]/

interface Item {
  href: string
  label: string
}

/** Scrolls the sidebar, never the page, so the current item is in view after a deep link. */
function reveal(container: HTMLElement, item: HTMLElement) {
  const box = container.getBoundingClientRect()
  const at = item.getBoundingClientRect()
  if (container.scrollWidth > container.clientWidth && (at.left < box.left || at.right > box.right)) {
    container.scrollLeft += at.left - box.left - (box.width - at.width) / 2
  }
  if (container.scrollHeight > container.clientHeight && (at.top < box.top || at.bottom > box.bottom)) {
    container.scrollTop += at.top - box.top - (box.height - at.height) / 2
  }
}

export function CatalogNav({ entries }: { entries: { name: string; group: string }[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const fieldId = useId()

  const needle = query.trim().toLowerCase()
  const matches = (label: string) => label.toLowerCase().includes(needle)
  const groups: { name: string; items: Item[] }[] = [
    ...[...new Set(entries.map(e => e.group))].map(group => ({
      name: group,
      items: entries.filter(e => e.group === group).map(e => ({ href: `/catalog/${e.name}`, label: e.name })),
    })),
    { name: 'Foundations', items: FOUNDATIONS },
  ]
    .map(g => ({ ...g, items: g.items.filter(i => matches(i.label)) }))
    .filter(g => g.items.length > 0)

  useEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (list && current) reveal(list, current)
  }, [pathname])

  // The pane swaps in place: the page keeps its scroll, and the address stays a shareable deep link.
  const select = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const kept = new URLSearchParams(window.location.search)
    const carry = new URLSearchParams()
    if (COMPONENT_HREF.test(href)) {
      for (const key of ['density', 'state']) {
        const value = kept.get(key)
        if (value) carry.set(key, value)
      }
    }
    const search = carry.toString()
    router.replace(search ? `${href}?${search}` : href, { scroll: false })
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.filter}>
        <label className={styles.filterLabel} htmlFor={fieldId}>
          Filter components
        </label>
        <input
          id={fieldId}
          className={styles.filterField}
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div ref={listRef} className={styles.navScroll}>
        <nav className={styles.nav} aria-label="Catalog">
          {groups.map(group => (
            <section key={group.name} className={styles.navGroup} aria-label={group.name}>
              <p className={styles.navLabel}>
                <span>{group.name}</span>
                <span>{group.items.length}</span>
              </p>
              <ul className={styles.navList}>
                {group.items.map(item => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.navItem}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      onClick={event => select(event, item.href)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <p className={styles.navEmpty} role="status">
          {groups.length === 0 ? 'No component matches' : ''}
        </p>
      </div>
    </div>
  )
}
