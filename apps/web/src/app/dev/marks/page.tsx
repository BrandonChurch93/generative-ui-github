import { DevMarks } from './DevMarks'

export const metadata = { title: 'Marks · Generative UI for GitHub Repos', robots: { index: false } }

/** Every placed mark at every density, for the e2e check that stylesheet order never moves one. */
export default function DevMarksPage() {
  return <DevMarks />
}
