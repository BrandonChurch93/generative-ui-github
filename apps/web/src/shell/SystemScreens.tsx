'use client'

import type { Refusal } from './useComposition'

export interface SystemScreenProps {
  repo: string
  refusal: Refusal
  timeZone?: string
  onRetry: () => void
}

/** What takes the answer's place when the app could not compose one: rate limit, daily cap, visitor limit, bad repo. */
export function SystemScreen({ refusal }: SystemScreenProps) {
  return <p>{refusal.message}</p>
}
