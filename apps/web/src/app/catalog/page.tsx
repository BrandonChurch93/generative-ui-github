import styles from './catalog.module.css'

export default function CatalogIndex() {
  return (
    <section className={styles.welcome} aria-labelledby="catalog-start">
      <h2 id="catalog-start" className="sr-only">
        Start here
      </h2>
      <p className={styles.welcomeLine}>
        Pick a component. It renders from sample data, then rebuilds each time you switch state or density.
      </p>
    </section>
  )
}
