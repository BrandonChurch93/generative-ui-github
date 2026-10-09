import { z } from 'zod'
import type { ComponentSpec } from '../../registry'
import { prose } from '../../schema/shared'

export const TEXT_INPUT_KINDS = ['text', 'identifier'] as const
export const VALIDATORS = ['repo', 'branch', 'handle', 'none'] as const
export type Validator = (typeof VALIDATORS)[number]

/** The model-facing fields, shared with the TextInput entry of a Form's `fields`. */
export const textInputShape = {
  label: z.string().min(1).max(32),
  placeholder: z.string().min(1).max(48).optional(),
  helper: prose(80).optional(),
  kind: z.enum(TEXT_INPUT_KINDS),
  validate: z.enum(VALIDATORS),
  required: z.boolean().optional(),
}

export const textInputSchema = z.object(textInputShape).strict()

export type TextInputModelProps = z.infer<typeof textInputSchema>

/** Every way a value can be wrong. Each maps to fixed wording, so the same mistake always reads the same. */
export const PROBLEMS = [
  'required',
  'repo-shape',
  'repo-host',
  'repo-format',
  'repo-missing',
  'branch-format',
  'branch-missing',
  'handle-format',
  'handle-missing',
  'choose',
] as const
export type Problem = (typeof PROBLEMS)[number]

/**
 * What the system found when it checked a value with GitHub. `invalid` blocks submit and is crit;
 * `unreachable` is GitHub failing, never the reader, so it is the shared neutral error; `checking` is the wait.
 */
export type FieldStatus = { kind: 'invalid'; problem: Problem } | { kind: 'unreachable'; cause: string } | { kind: 'checking' } | { kind: 'resolved'; value: string }

/** What a field's message slot shows. The words are always the system's. */
export type FieldMessage =
  | { kind: 'helper'; text: string }
  | { kind: 'invalid'; text: string }
  | { kind: 'unreachable'; failed: string; cause: string }
  | { kind: 'checking'; text: string }
  | { kind: 'resolved'; text: string }

/** What TextInput renders: the model's words plus what the system binds. */
export interface TextInputProps {
  label: string
  placeholder?: string
  helper?: string
  kind: 'text' | 'identifier'
  validate: Validator
  required?: boolean
  /** System. The value the field arrives with: the screen's current scope. */
  value?: string
  /** System. The field's key in a Form's submitted values; derived from the label when absent. */
  name?: string
  /** System. `hero` is the landing page's paste-a-repo field, never composed. */
  size?: 'field' | 'hero'
  /** System. The hero's primary button label. */
  action?: string
  /** System. What GitHub said about the value. */
  status?: FieldStatus
  /** System. A disabled field always says why: `reason` takes the helper's slot. */
  disabled?: boolean
  /** System. Why the field is disabled, such as "Fixed by this screen · start over to change it". */
  reason?: string
  /** System. The hero's submit, with the trimmed value. */
  onSubmit?: (value: string) => void
}

const article = (noun: string) => (/^[aeiou]/i.test(noun) ? 'an' : 'a')

export const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1)

export function plural(noun: string): string {
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`
  return `${noun}s`
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const REQUIRED_WORDS: Record<Validator, string> = {
  repo: 'Paste a public GitHub repo',
  branch: 'Name a branch',
  handle: 'Name a GitHub handle',
  none: 'Fill this in to go on',
}

const PROBLEM_WORDS: Record<Exclude<Problem, 'required' | 'choose'>, string> = {
  'repo-shape': 'Needs owner/name, like vercel/next.js',
  'repo-host': 'Only github.com repos',
  'repo-format': "That isn't a GitHub repo · try owner/name",
  'repo-missing': "That repo is private or doesn't exist",
  'branch-format': "That isn't a branch name · no spaces or double dots",
  'branch-missing': "That branch doesn't exist on this repo",
  'handle-format': "That isn't a GitHub handle · letters, digits and single hyphens",
  'handle-missing': 'No GitHub account has that handle',
}

/** The noun a validator checks, for the system's sentences about it. */
export const SUBJECT: Record<Validator, string> = { repo: 'repo', branch: 'branch', handle: 'handle', none: 'value' }

/** Every sentence a field's message slot can say, written by code. */
export const fieldWords = {
  problem(problem: Problem, context: { validate?: Validator; label: string }): string {
    if (problem === 'required') return REQUIRED_WORDS[context.validate ?? 'none']
    if (problem === 'choose') {
      const noun = lower(context.label)
      return `Pick ${article(noun)} ${noun} to ask about`
    }
    return PROBLEM_WORDS[problem]
  },
  unreachable: (validate: Validator) => `Couldn't check this ${SUBJECT[validate]}`,
  checking: (value: string) => `Checking ${value} on GitHub`,
  /** GitHub found it: the value as GitHub names it, which may differ from what was typed (a renamed repo). */
  resolved: (value: string, validate: Validator) => `Found ${value} on GitHub${validate === 'repo' ? ' · ready for a question' : ''}`,
  /** A field that depends on a wrong one waits; it never shows an error of its own. */
  waiting: (label: string, subject: string) => `${capital(plural(lower(label)))} load once the ${subject} checks out`,
  noOptions: (label: string) => `No ${plural(lower(label))} to choose from`,
  optional: 'optional',
  heroLabel: 'Public GitHub repository',
  heroAction: 'Open repo',
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/
const BRANCH_BAD = /(^[-/.])|(\.\.)|(\/\/)|([\s~^:?*[\\])|(\.lock$)|([/.]$)|(@\{)/

/** The checks that need no network. GitHub answers the rest (a missing repo, branch or handle) as a FieldStatus. */
export function checkValue(validate: Validator, raw: string, required = true): Problem | undefined {
  const value = raw.trim()
  if (!value) return required ? 'required' : undefined
  switch (validate) {
    case 'repo': {
      let path = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      const host = path.split('/')[0] ?? ''
      if (host.includes('.')) {
        if (!/^(www\.)?github\.com$/i.test(host)) return 'repo-host'
        path = path.slice(host.length)
      }
      const [owner, name] = path.split('/').filter(Boolean)
      if (!owner || !name) return 'repo-shape'
      if (!OWNER.test(owner) || !REPO_NAME.test(name.replace(/\.git$/i, ''))) return 'repo-format'
      return undefined
    }
    case 'branch':
      return value.length > 255 || BRANCH_BAD.test(value) ? 'branch-format' : undefined
    case 'handle':
      return OWNER.test(value.replace(/^@/, '')) ? undefined : 'handle-format'
    case 'none':
      return undefined
  }
}

/** Resolves what the slot says: GitHub's verdict, else the helper. */
export function messageFor(
  field: Pick<TextInputProps, 'label' | 'validate' | 'helper' | 'disabled' | 'reason'>,
  value: string,
  status: FieldStatus | undefined,
): FieldMessage | undefined {
  if (field.disabled && field.reason) return { kind: 'helper', text: field.reason }
  if (status?.kind === 'invalid') return { kind: 'invalid', text: fieldWords.problem(status.problem, field) }
  if (status?.kind === 'unreachable') return { kind: 'unreachable', failed: fieldWords.unreachable(field.validate), cause: status.cause }
  if (status?.kind === 'checking') return { kind: 'checking', text: fieldWords.checking(value.trim()) }
  if (status?.kind === 'resolved') return { kind: 'resolved', text: fieldWords.resolved(status.value, field.validate) }
  return field.helper ? { kind: 'helper', text: field.helper } : undefined
}

export const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const textInputSpec: ComponentSpec<typeof textInputSchema> = {
  name: 'TextInput',
  schema: textInputSchema,
  when: 'Only inside a Form, for a value that cannot be offered as a list: a repo, a branch, a handle.',
  pickable: false,
  statesOmitted: [
    { state: 'skeleton', reason: 'A field has nothing to load and renders at once; checking is its own wait.' },
    { state: 'empty', reason: 'An unfilled field is the default state, with its placeholder.' },
    { state: 'warming', reason: 'An input never waits on a GitHub 202.' },
  ],
  id: { key: p => slug(p.label) },
  example: { label: 'Repository', placeholder: 'owner/name', kind: 'identifier', validate: 'repo' },
}
