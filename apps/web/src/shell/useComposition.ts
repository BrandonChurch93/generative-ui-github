'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WarmingStatus } from '@genui-github/data'
import type { StreamTree } from '@genui-github/renderer'

// The client half of POST /api/compose: send the question, read the JSONL into a tree as it arrives, and
// while GitHub counts, ask again on the warming schedule with the status the last answer carried.

export type RefusalKind = 'repo' | 'visitor-limit' | 'daily-cap' | 'rate-limit' | 'bad-request' | 'network'

export interface Refusal {
  error: RefusalKind
  message: string
  resetAt?: string
}

export interface Question {
  question: string
  from?: { id: string; ask: string }
  /** Bumped to ask the same question again. */
  n: number
}

export interface Served {
  served?: 'golden' | 'cache'
  cachedAt?: string
  /** At the daily cap: when live questions open again. */
  capped?: string
}

export interface CompositionState {
  phase: 'idle' | 'composing' | 'done' | 'refused'
  tree: StreamTree
  refusal?: Refusal
  served: Served
  /** Set while the answer is the WarmingUp screen. */
  warming?: WarmingStatus
}

const emptyTree = (): StreamTree => ({ asks: [], regions: { insight: [], metrics: [], main: [], side: [], action: [] }, done: false })

const warmingIn = (tree: StreamTree): WarmingStatus | undefined => {
  const piece = tree.regions.main.find(p => p.component === 'WarmingUp')
  return piece ? (piece.bound as WarmingStatus) : undefined
}

const FALLBACK: Record<number, string> = { 502: 'GitHub returned 502', 503: 'the service is unavailable', 504: 'the request timed out' }

export function useComposition(repo: string, ask: Question | null, force?: string) {
  const [state, setState] = useState<CompositionState>({ phase: 'idle', tree: emptyTree(), served: {} })
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback(
    async (current: Question, warming?: WarmingStatus) => {
      controller.current?.abort()
      if (timer.current) clearTimeout(timer.current)
      const abort = new AbortController()
      controller.current = abort
      setState(s => ({ ...s, phase: 'composing', refusal: undefined }))
      let response: Response
      try {
        response = await fetch(`/api/compose${force ? `?force=${encodeURIComponent(force)}` : ''}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            repo,
            question: current.question,
            ...(current.from ? { from: current.from } : {}),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(warming ? { warming } : {}),
          }),
          signal: abort.signal,
        })
      } catch {
        if (abort.signal.aborted) return
        setState(s => ({ ...s, phase: 'refused', refusal: { error: 'network', message: "Couldn't reach the composer · the network request failed" } }))
        return
      }
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as Partial<Refusal>
        if (abort.signal.aborted) return
        const refusal: Refusal = {
          error: body.error ?? 'network',
          message: body.message ?? `Couldn't compose an answer · ${FALLBACK[response.status] ?? `the server returned ${response.status}`}`,
          ...(body.resetAt ? { resetAt: body.resetAt } : {}),
        }
        setState(s => ({ ...s, phase: 'refused', refusal }))
        return
      }
      const served: Served = {
        served: (response.headers.get('x-genui-served') as Served['served']) ?? undefined,
        cachedAt: response.headers.get('x-genui-cached-at') ?? undefined,
        capped: response.headers.get('x-genui-capped') ?? undefined,
      }
      // The parser validates every op against the schemas, which load with the first answer, not with the page.
      const { createStreamParser } = await import('@genui-github/renderer/core')
      if (abort.signal.aborted) return
      const parser = createStreamParser()
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (abort.signal.aborted) return
          if (done) break
          const tree = parser.push(value)
          // Until a start op arrives, the last screen stays up so the new one can rewrite it.
          if (tree.id) setState(s => ({ ...s, tree, served }))
        }
      } catch {
        if (abort.signal.aborted) return
      }
      let tree = parser.end()
      if (tree.id && !tree.done) tree = { ...tree, done: true, error: 'the connection closed before the answer finished' }
      const nextWarming = warmingIn(tree)
      setState(s => ({ ...s, phase: 'done', tree: tree.id ? tree : s.tree, served, warming: nextWarming }))
      if (nextWarming?.phase === 'warming') timer.current = setTimeout(() => void run(current, nextWarming), Math.max(1000, nextWarming.nextCheckMs))
    },
    [repo, force],
  )

  useEffect(() => {
    if (!ask) return
    void run(ask)
    return () => {
      controller.current?.abort()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [ask, run])

  return state
}
