import type { ConfigProblem } from '@genui-github/core'

export interface ConfigErrorCopy {
  label: string
  failed: string
  cause: string
  fix: string
  variables: string[]
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** The system's words for a server that cannot start composing. Names variables, never values. */
export function configErrorCopy(problems: ConfigProblem[]): ConfigErrorCopy {
  const missing = problems.filter(p => p.message.endsWith('is not set')).map(p => p.variable)
  const invalid = problems.filter(p => !p.message.endsWith('is not set'))
  const parts: string[] = []
  if (missing.length) parts.push(`${joinNames(missing)} ${missing.length === 1 ? 'is' : 'are'} not set`)
  for (const p of invalid) parts.push(p.message)
  return {
    label: 'Configuration',
    failed: "Couldn't start the composer",
    cause: parts.join(' · '),
    fix: 'Copy .env.example to .env.local, fill in the values, and restart the server.',
    variables: problems.map(p => p.variable),
  }
}
