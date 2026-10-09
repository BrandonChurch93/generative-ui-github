import type { AnimationPlaybackControls } from 'motion/react'

/** Performance marks the renderer leaves, so a test or the built block can read the timing. */
export const MARKS = {
  start: 'genui:screen:start',
  insight: 'genui:insight:visible',
  complete: 'genui:screen:complete',
  measure: 'genui:screen',
} as const

interface Running {
  finish(): void
}

function mark(name: string, detail?: unknown) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  performance.mark(name, { detail })
}

/**
 * Owns every animation of one screen change. A new change finishes whatever is still running, so two
 * timelines never run at once and nothing is left half drawn.
 */
export class Conductor {
  generation = 0
  private running = new Set<Running>()
  private pending = 0
  private insightMarked = false
  private onPhase?: (phase: 'composing' | 'settled', generation: number) => void

  constructor(options: { onPhase?: (phase: 'composing' | 'settled', generation: number) => void } = {}) {
    this.onPhase = options.onPhase
  }

  /** Starts a screen change: whatever the last one left running jumps to its end. */
  begin(): number {
    for (const r of [...this.running]) r.finish()
    this.running.clear()
    this.generation += 1
    this.pending = 0
    this.insightMarked = false
    mark(MARKS.start, { generation: this.generation })
    const generation = this.generation
    this.onPhase?.('composing', generation)
    // Pieces register in their layout effects; if none did, the change settles at once.
    queueMicrotask(() => {
      if (generation === this.generation && this.pending === 0) this.settle()
    })
    return generation
  }

  private track(finish: () => void, done: Promise<unknown>, generation: number, onDone?: () => void, label?: string) {
    const entry: Running = { finish }
    this.running.add(entry)
    if (generation === this.generation) this.pending += 1
    const close = () => {
      this.running.delete(entry)
      if (label && generation === this.generation) mark(`genui:done:${label}`, { generation })
      onDone?.()
      if (generation !== this.generation) return
      this.pending -= 1
      if (this.pending === 0) this.settle()
    }
    done.then(close, close)
  }

  /** A GSAP timeline the change started. */
  timeline(tl: gsap.core.Timeline, generation = this.generation, onDone?: () => void, label?: string): gsap.core.Timeline {
    let resolve!: () => void
    const done = new Promise<void>(r => (resolve = r))
    // An empty timeline never ticks to completion, so it would hold the screen open forever.
    if (tl.duration() === 0) resolve()
    else tl.eventCallback('onComplete', resolve)
    this.track(
      () => {
        tl.progress(1)
        tl.kill()
        resolve()
      },
      done,
      generation,
      onDone,
      label,
    )
    return tl
  }

  /** A Motion animation on a piece's wrapper. */
  motion(controls: AnimationPlaybackControls, generation = this.generation, onDone?: () => void, label?: string): AnimationPlaybackControls {
    this.track(() => controls.complete(), controls.finished, generation, onDone, label)
    return controls
  }

  /** The insight is readable: its sentence has finished arriving. */
  insightVisible(generation: number) {
    if (generation !== this.generation || this.insightMarked) return
    this.insightMarked = true
    mark(MARKS.insight, { generation })
  }

  private settle() {
    mark(MARKS.complete, { generation: this.generation })
    if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
      try {
        performance.measure(MARKS.measure, { start: MARKS.start, end: MARKS.complete, detail: { generation: this.generation } })
      } catch {
        // A cleared mark buffer is not worth failing a screen over.
      }
    }
    this.onPhase?.('settled', this.generation)
  }

  /** Finishes everything; for unmount. */
  dispose() {
    for (const r of [...this.running]) r.finish()
    this.running.clear()
  }
}
