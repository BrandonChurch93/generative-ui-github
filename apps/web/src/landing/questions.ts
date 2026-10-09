import type { TemplateId } from '@genui-github/composer'

/** One row of the landing's questions: a group named by what it reveals, the pieces it draws, its questions. */
export interface QuestionGroup {
  label: string
  /** The pieces the group's screens are built from, in the system's words. */
  draws: string
  questions: string[]
}

/** The twelve golden questions grouped as docs/golden-questions.md "Landing page groups" sets them. */
export const GROUPS: readonly { label: string; draws: string; templates: TemplateId[] }[] = [
  { label: 'Shipping', draws: 'status lists · timelines · file trees', templates: ['release-blockers', 'merged-recent', 'release-diff'] },
  { label: 'Health', draws: 'line charts · comparisons', templates: ['ci-trend', 'responsiveness', 'month-compare'] },
  { label: 'People', draws: 'contributor ranks · heatmaps', templates: ['contributors', 'punch-card', 'stale-issues'] },
  { label: 'Getting started', draws: 'steps · checklists · diffs', templates: ['new-contributor', 'overview', 'biggest-pr'] },
]

/** The five sample repos by the names docs/decisions.md uses; react's old name still finds its sample. */
export const SAMPLE_NAMES = ['vercel/next.js', 'facebook/react', 'anthropics/claude-code', 'tailwindlabs/tailwindcss', 'vitejs/vite'] as const

/** The preselected sample, and the question the landing's preview answers on it. */
export const PREVIEW = { repo: 'vercel/next.js', template: 'release-blockers' } as const satisfies { repo: string; template: TemplateId }
