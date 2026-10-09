// Compiled by pnpm typecheck, never run. A misspelled token must be a type error.
import { cssVar, type TokenName } from './tokens'

export const known: TokenName = 'accent'
export const knownVar: 'var(--accent)' = cssVar('accent')

// @ts-expect-error misspelled token
export const misspelled: TokenName = 'acent'

// @ts-expect-error misspelled token
cssVar('surfce')
