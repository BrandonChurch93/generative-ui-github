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
  /** Lets go of the animation where it stands, without jumping it to its end. */
  close(): void
  /** The change it counts toward; a carried exit moves to the next one. */
  generation: number
}

function mark(name: string, detail?: unknown) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  performance.mark(name, { detail })
}

/**
 * Owns every animation of one screen change. A new change finishes whatever is still running, so two
 * timelines never run at once and nothing is left half drawn.
 */
export interface MotionHandle {
  complete(): void
  /** Stops where it stands; for a leave a returning piece takes back. */
  cancel(): void
  finished: Promise<void>
}

export class Conductor {
  generation = 0
  private running = new Set<Running>()
  private byTarget = new Map<object, Running>()
  private pending = 0
  private insightMarked = false
  private onPhase?: (phase: 'composing' | 'settled', generation: number) => void

  constructor(options: { onPhase?: (phase: 'composing' | 'settled', generation: number) => void } = {}) {
    this.onPhase = options.onPhase
  }

  /**
   * Starts a screen change: whatever the last one left running jumps to its end. With `carry`, it keeps
   * running and counts toward this change instead: the exits a leave started belong to the rewrite that follows.
   */
  begin(carry = false): number {
    if (!carry) {
      for (const r of [...this.running]) r.finish()
      this.running.clear()
      this.byTarget.clear()
    }
    this.generation += 1
    this.pending = 0
    if (carry) {
      for (const r of this.running) {
        r.generation = this.generation
        this.pending += 1
      }
    }
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

  private track(target: object, finish: () => void, done: Promise<unknown>, generation: number, onDone?: () => void, label?: string): Running {
    let closed = false
    const entry: Running = {
      finish,
      generation,
      close: () => {
        if (closed) return
        closed = true
        this.running.delete(entry)
        if (this.byTarget.get(target) === entry) this.byTarget.delete(target)
        if (label && entry.generation === this.generation) mark(`genui:done:${label}`, { generation: entry.generation })
        onDone?.()
        if (entry.generation !== this.generation) return
        this.pending -= 1
        if (this.pending === 0) this.settle()
      },
    }
    this.running.add(entry)
    this.byTarget.set(target, entry)
    if (generation === this.generation) this.pending += 1
    done.then(entry.close, entry.close)
    return entry
  }

  /** A GSAP timeline the change started. */
  timeline(tl: gsap.core.Timeline, generation = this.generation, onDone?: () => void, label?: string): gsap.core.Timeline {
    let resolve!: () => void
    const done = new Promise<void>(r => (resolve = r))
    // An empty timeline never ticks to completion, so it would hold the screen open forever.
    if (tl.duration() === 0) resolve()
    else tl.eventCallback('onComplete', resolve)
    this.track(
      tl,
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

  /** Kills a timeline where it stands: a leave whose piece came back before its exit showed. */
  drop(tl: gsap.core.Timeline) {
    tl.kill()
    this.byTarget.get(tl)?.close()
  }

  /** Plays a timeline back to its start: a leave whose piece the next answer keeps. */
  reverse(tl: gsap.core.Timeline, generation = this.generation): gsap.core.Timeline {
    this.byTarget.get(tl)?.close()
    let resolve!: () => void
    const done = new Promise<void>(r => (resolve = r))
    tl.eventCallback('onComplete', null)
    tl.eventCallback('onReverseComplete', resolve)
    tl.reverse()
    this.track(
      tl,
      () => {
        tl.progress(0)
        tl.kill()
        resolve()
      },
      done,
      generation,
    )
    return tl
  }

  /**
   * A Motion animation on a piece's wrapper. Motion never settles `finished` for an animation that a newer one
   * on the same element replaced, so the returned handle resolves on its own when it is completed early.
   */
  motion(controls: AnimationPlaybackControls, generation = this.generation, onDone?: () => void, label?: string): MotionHandle {
    let resolve!: () => void
    const finished = new Promise<void>(r => (resolve = r))
    controls.finished.then(() => resolve(), () => resolve())
    const complete = () => {
      controls.complete()
      resolve()
    }
    const entry = this.track(controls, complete, finished, generation, onDone, label)
    const cancel = () => {
      controls.stop()
      resolve()
      entry.close()
    }
    return { complete, cancel, finished }
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
    this.byTarget.clear()
  }
}
