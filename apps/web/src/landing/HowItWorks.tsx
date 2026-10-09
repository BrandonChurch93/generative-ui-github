import { Preview, type LandingPreview } from './Preview'
import styles from './HowItWorks.module.css'

/** The section's address, which the landing's "How it works" link scrolls to. */
export const HOW_ID = 'how-it-works'

/** The three steps, in the system's words; each one's number is the callout on the picture beside it. */
const STEPS = [
  {
    title: 'Pick a repo',
    body: "Every figure is read from the repo's public GitHub data, and each number in the insight is checked against it.",
  },
  {
    title: 'Ask a question',
    body: 'A model picks the layout and what to stress, like the metric it marks as hot.',
  },
  {
    title: 'Click anything and the screen rebuilds around it',
    body: 'Cards, rows and chart points ask a follow-up, and the screen recomposes around the one you clicked.',
  },
] as const

/** How it works, inline in the reading line: three steps, and a composed answer with their numbers on it. */
export function HowItWorks({ preview }: { preview: LandingPreview | null }) {
  return (
    <section className={styles.how} id={HOW_ID} aria-labelledby={`${HOW_ID}-title`} tabIndex={-1} data-how-section="">
      <h2 className={styles.title} id={`${HOW_ID}-title`}>
        How it works
      </h2>
      <div className={styles.grid} data-preview={preview ? '' : undefined}>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.badge} aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {preview && <Preview preview={preview} />}
      </div>
    </section>
  )
}
