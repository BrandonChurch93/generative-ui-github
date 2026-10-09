import { z } from 'zod'
import type { WarmingStatus } from '@genui-github/data'
import type { ComponentSpec } from '../../registry'
import { CHECK_SCHEDULE } from '@genui-github/data'

export const STAT_IDS = ['contributors', 'participation', 'commit_activity', 'punch_card', 'code_frequency'] as const
export type StatId = (typeof STAT_IDS)[number]

export const STAT_STATES = ['counting', 'ready', 'cached', 'missing'] as const
export type StatState = (typeof STAT_STATES)[number]

/** Seconds after the first request at which every counting statistic is checked again (docs/data-layer.md). */
// The data layer owns the schedule: it is when GitHub is asked again, and the lanes draw those same moments.
export { CHECK_SCHEDULE }

const isoDate = z.iso.datetime({ offset: true })

/** The WarmingStatus shape from docs/schemas.md. Every field is set by the system; the model chooses nothing here. */
export const warmingUpSchema = z
  .object({
    repo: z.string().min(3).max(140),
    phase: z.enum(['warming', 'stopped']),
    attempt: z.number().int().min(1).max(CHECK_SCHEDULE.length),
    nextCheckMs: z.number().int().min(0),
    startedAt: isoDate,
    elapsedMs: z.number().int().min(0),
    stats: z
      .array(
        z
          .object({
            id: z.enum(STAT_IDS),
            state: z.enum(STAT_STATES),
            landedAt: isoDate.optional(),
            cachedAt: isoDate.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(STAT_IDS.length),
  })
  .strict()

export type WarmingUpModelProps = z.infer<typeof warmingUpSchema>

/**
 * What WarmingUp renders: the data layer's WarmingStatus as it stands at the last check. The component runs
 * its own clock from `elapsedMs` and `nextCheckMs` between checks; every word it shows comes from COPY below.
 */
export type WarmingUpProps = WarmingStatus

/** The system's words for each statistic: its row name, how a sentence names it, and what its endpoint counts. */
export const STATS: Record<StatId, { name: string; inSentence: string; counts: string }> = {
  contributors: { name: 'Contributors', inSentence: 'contributors', counts: 'weekly, by author' },
  participation: { name: 'Participation', inSentence: 'participation', counts: 'owners vs all' },
  commit_activity: { name: 'Commit activity', inSentence: 'commit activity', counts: '52 weeks' },
  punch_card: { name: 'Punch card', inSentence: 'the punch card', counts: 'weekday by hour' },
  code_frequency: { name: 'Code frequency', inSentence: 'code frequency', counts: 'lines added and removed, weekly' },
}

/** The words in a row's status column. A tag means the statistic has data; plain meta means it has none. */
export const STATUS_WORDS: Record<StatState, { words: string; tag?: 'good' | 'quiet' }> = {
  counting: { words: 'counting' },
  ready: { words: 'ready', tag: 'good' },
  cached: { words: 'cached', tag: 'quiet' },
  missing: { words: 'not ready' },
}

export const COPY = {
  region: 'Warming up',
  title: 'What GitHub is counting',
  axisNote: 'since the first request',
  noCopy: 'no earlier copy',
  copyFrom: (date: string) => `copy from ${date}`,
  firstSay: (repo: string) => `GitHub is counting \`${repo}\` for the first time.`,
  firstWhy:
    'This usually takes under a minute and only happens once per repo. Each part of the answer appears as soon as its count is ready.',
  retrySay: (repo: string) => `GitHub is still counting \`${repo}\`.`,
  retryWhy:
    'Repos with a long history can take a minute or two the first time. You can leave this open; the answer composes in by itself.',
  partlySay: (counting: string) => `GitHub is still counting ${counting}.`,
  partlyWhy: (ready: string, many: boolean) =>
    `${ready} ${many ? 'are' : 'is'} in, and ${many ? 'their parts' : 'its part'} of the answer ${many ? 'are' : 'is'} below. The rest usually follows within a minute.`,
  doneSay: (repo: string) => `GitHub has finished counting \`${repo}\`.`,
  doneWhy: 'Every part of the answer is ready.',
  stoppedSay: (repo: string) => `GitHub hasn't finished counting \`${repo}\` after 2 minutes.`,
  cachedOne: (name: string, age: string) => `${name} is shown from a copy counted ${age}.`,
  cachedMany: (names: string, age: string | null) =>
    age ? `${names} are shown from copies counted ${age}.` : `${names} are shown from earlier copies, dated in the card.`,
  missingOne: (name: string) => `${name} has no earlier copy, so it is left out until GitHub finishes.`,
  missingMany: (names: string) => `${names} have no earlier copy, so they are left out until GitHub finishes.`,
  when: (attempt: number, seconds: number) =>
    seconds > 0 ? `attempt ${attempt} · checking again in ${seconds}s` : `attempt ${attempt} · checking now`,
  stoppedWhen: (checks: number) => `stopped after ${checks} checks`,
  readyOf: (n: number) => ` of ${n} ready`,
  stoppedCounts: { ready: 'ready', cached: 'cached', missing: 'not ready' },
  firstSpoken: (repo: string, seconds: number) =>
    `GitHub is counting ${repo}. Nothing is ready yet. Checking again in ${secondsWords(seconds)}.`,
  retrySpoken: (repo: string, attempt: number, seconds: number) =>
    `Still counting ${repo}. Attempt ${attempt}. Checking again in ${secondsWords(seconds)}.`,
  partlySpoken: (ready: string, many: boolean, counting: string) =>
    `${ready} ${many ? 'are' : 'is'} ready.${counting ? ` Still counting ${counting}.` : ''}`,
  stoppedSpoken: "GitHub hasn't finished counting after 2 minutes.",
  cachedSpoken: (names: string, many: boolean, age: string | null) =>
    many
      ? `${names} are shown from ${age ? `copies counted ${age}` : 'earlier copies'}.`
      : `${names} is shown from a copy counted ${age}.`,
  missingSpoken: (names: string, many: boolean) => `${names} ${many ? 'are' : 'is'} left out.`,
  failed: "Couldn't check what GitHub is counting",
} as const

function secondsWords(seconds: number): string {
  return seconds === 1 ? '1 second' : `${seconds} seconds`
}

export const warmingUpSpec: ComponentSpec<typeof warmingUpSchema> = {
  name: 'WarmingUp',
  schema: warmingUpSchema,
  when: 'Never picked. The shell shows it in place of the composition while GitHub counts a statistic the composition needs.',
  heightClass: 'grows',
  pickable: false,
  statesOmitted: [
    { state: 'skeleton', reason: 'It appears only after a 202 has come back, so its status is known when it renders; it replaces skeletons and never shows one.' },
    { state: 'empty', reason: 'The shell shows it only while at least one statistic the composition needs is counting or has stopped; with none, the composition renders instead.' },
    { state: 'warming', reason: 'It is the warming display: its default state is what every other piece points to while it waits on a 202.' },
  ],
  id: { key: p => p.repo },
  example: {
    repo: 'vercel/next.js',
    phase: 'warming',
    attempt: 2,
    nextCheckMs: 3000,
    startedAt: '2026-10-08T14:02:00Z',
    elapsedMs: 7000,
    stats: [
      { id: 'contributors', state: 'counting' },
      { id: 'commit_activity', state: 'counting' },
    ],
  },
}
