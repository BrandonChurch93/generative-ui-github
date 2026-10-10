import styles from '../../_gallery/gallery.module.css'

export default function UnknownComponent() {
  return (
    <p className={styles.unknown} role="status">
      No component has that name · every one is below
    </p>
  )
}
