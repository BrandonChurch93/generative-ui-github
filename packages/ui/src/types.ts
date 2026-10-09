export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export type Density = (typeof DENSITIES)[number]

export const TONES = ['neutral', 'good', 'warn', 'crit'] as const
export type Tone = (typeof TONES)[number]

export const EMPHASES = ['low', 'medium', 'high'] as const
export type Emphasis = (typeof EMPHASES)[number]

export type EmptyTone = 'neutral' | 'good'

export const HEIGHT_CLASSES = ['fixed', 'grows', 'plot'] as const
export type HeightClass = (typeof HEIGHT_CLASSES)[number]

export const COMPONENT_STATES = ['default', 'skeleton', 'empty', 'error', 'warming'] as const
export type ComponentState = (typeof COMPONENT_STATES)[number]

/** The system's words for a failed piece: what failed in ink, the cause in meta. */
export interface ErrorInfo {
  failed: string
  cause: string
}

/** The system's words for a piece waiting on a GitHub 202. `progress` runs 0 to 1. */
export interface WarmingInfo {
  counting: string
  nextCheck: string
  progress: number
}

/** What every component receives. `props` are the bound props: the model's choices plus the system's data. */
export interface PieceRenderProps<P> {
  props: P
  state: ComponentState
  error?: ErrorInfo
  warming?: WarmingInfo
  tone?: Tone
  emphasis?: Emphasis
  /** The question a click on the whole piece asks. With `onAsk`, the piece becomes a button. */
  ask?: string
  onRetry?: () => void
  onAsk?: (ask: string) => void
  /** Opens the shell's drawer with what a piece made (ActionCard's drafts). Without it, the piece shows them inline. */
  onOpenDrawer?: (content: { title: string; items: string[] }) => void
}
