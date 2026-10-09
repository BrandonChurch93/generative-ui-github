import { readFileSync } from 'node:fs'
import { dirFrom } from '../paths'
import { createGitHubClient, type GitHubClient } from './client'
import { replayFetch, type Recording } from './recording'

/** Where `pnpm fixtures:record` writes, one JSON per scenario. */
export const FIXTURE_DIR = dirFrom(import.meta.url, '../../fixtures/github/')

/** A recorded scenario to drive fetchers in a test, and the replay so a test can assert nothing was missed. */
export interface Scenario {
  name: string
  /** What runs against GitHub when recording; the test runs the same calls against the replay. */
  run(client: GitHubClient): Promise<unknown>
  /** Trims a large response body before it is written, so fixtures stay small. */
  trim?(key: string, body: unknown): unknown
}

export function loadRecording(name: string): Recording {
  return JSON.parse(readFileSync(`${FIXTURE_DIR}${name}.json`, 'utf8')) as Recording
}

export function fixtureClient(name: string): { client: GitHubClient; misses: string[] } {
  const fetch = replayFetch(loadRecording(name))
  return { client: createGitHubClient({ token: 'replay', fetch, sleep: async () => {} }), misses: fetch.misses }
}
