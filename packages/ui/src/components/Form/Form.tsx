'use client'

import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { CardFrame, cx, Mark, TextLink } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { ChipsField } from '../FilterChips/FilterChips'
import { chipWords } from '../FilterChips/schema'
import { selectMessage, SelectField } from '../Select/Select'
import { swapMessage } from '../TextInput/motion'
import { checkValue, fieldWords, lower, messageFor, SUBJECT, type FieldMessage, type FieldStatus, type Problem } from '../TextInput/schema'
import { TextInputField } from '../TextInput/TextInput'
import fieldStyles from '../TextInput/TextInput.module.css'
import { fieldName, formWords, type FormField, type FormProps, type FormValues } from './schema'
import styles from './Form.module.css'

const initialValue = (field: FormField): string | string[] =>
  field.component === 'FilterChips' ? field.selected : field.component === 'Select' ? field.value : (field.value ?? '')

const initialValues = (fields: FormField[]): FormValues => Object.fromEntries(fields.map((f, i) => [fieldName(f, i), initialValue(f)]))

/** What the system's sentences call a field: the thing its validator checks, or its label. */
const subjectOf = (field: FormField) =>
  field.component === 'TextInput' && field.validate !== 'none' ? SUBJECT[field.validate] : lower(field.label)

/** The checks that need no network. GitHub's verdicts arrive on each field's `status`. */
function localProblem(field: FormField, value: string | string[] | undefined): Problem | undefined {
  if (field.component === 'TextInput') return checkValue(field.validate, typeof value === 'string' ? value : '', field.required !== false)
  if (field.component === 'Select') return field.required !== false && field.options.length > 0 && !value ? 'choose' : undefined
  return undefined
}

export function Form({ props, state, error, onRetry }: PieceRenderProps<FormProps>) {
  const baseId = useId()
  const { fields } = props
  const names = fields.map((f, i) => fieldName(f, i))
  const [values, setValues] = useState<FormValues>(() => initialValues(fields))
  const [problems, setProblems] = useState<Record<string, Problem | undefined>>({})
  const [attempted, setAttempted] = useState(false)
  const [pending, setPending] = useState(false)
  // A verdict from GitHub is about the value it checked; once the reader edits that field, it no longer applies.
  const [editedOver, setEditedOver] = useState<Record<string, FieldStatus | undefined>>({})
  const effectRef = useRef<HTMLDivElement>(null)
  const lastFailed = useRef<boolean | null>(null)

  const failed = state === 'error'
  const submitting = !failed && (props.submitting ?? pending)
  const controlId = (i: number) => `${baseId}-field-${i}`

  const statusOf = (i: number): FieldStatus | undefined => {
    const field = fields[i]!
    if (field.component === 'FilterChips') return undefined
    return field.status !== editedOver[names[i]!] ? field.status : undefined
  }
  const isWrong = (i: number) => Boolean(problems[names[i]!]) || statusOf(i)?.kind === 'invalid'
  const waitsOn = (i: number): number => {
    const dep = fields[i]!.dependsOn
    if (!dep) return -1
    const j = names.indexOf(dep)
    return j >= 0 && (isWrong(j) || statusOf(j)?.kind === 'checking') ? j : -1
  }

  const firstInvalid = (found: Record<string, Problem | undefined>) =>
    fields.findIndex((_, i) => waitsOn(i) < 0 && (found[names[i]!] || statusOf(i)?.kind === 'invalid'))

  const send = () => {
    setPending(true)
    props.onSubmit?.(values)
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (submitting) return
    const found = Object.fromEntries(fields.map((f, i) => [names[i]!, localProblem(f, values[names[i]!])]))
    setProblems(found)
    setAttempted(true)
    const first = firstInvalid(found)
    if (first >= 0) {
      document.getElementById(controlId(first))?.focus()
      return
    }
    send()
  }

  const change = (i: number, next: string | string[]) => {
    const name = names[i]!
    setValues(v => ({ ...v, [name]: next }))
    const field = fields[i]!
    if (field.component !== 'FilterChips') setEditedOver(e => ({ ...e, [name]: field.status }))
    if (field.component === 'Select' && typeof next === 'string') field.onChange?.(next)
    if (field.component === 'FilterChips' && Array.isArray(next)) field.onChange?.(next)
  }

  // Validation runs on submit, then on blur.
  const blur = (i: number) => {
    if (!attempted) return
    const name = names[i]!
    setProblems(p => ({ ...p, [name]: localProblem(fields[i]!, values[name]) }))
  }

  const reset = () => {
    setValues(initialValues(fields))
    setProblems({})
    setAttempted(false)
    setEditedOver({})
  }

  // The effect line and the unreachable line share one slot; one replaces the other with the message wipe.
  useLayoutEffect(() => {
    const changed = lastFailed.current !== null && lastFailed.current !== failed
    lastFailed.current = failed
    const line = effectRef.current?.firstElementChild ?? null
    if (!changed || !line) return
    const tl = swapMessage(null, line)
    return () => {
      tl.progress(1).kill()
    }
  }, [failed])

  const messageOf = (i: number): FieldMessage | undefined => {
    const field = fields[i]!
    const name = names[i]!
    const problem = problems[name]
    if (problem) return { kind: 'invalid', text: fieldWords.problem(problem, field) }
    const status = statusOf(i)
    if (field.component === 'TextInput') return messageFor(field, String(values[name] ?? ''), status)
    if (field.component === 'Select') return selectMessage({ ...field, status })
    return undefined
  }

  const renderField = (field: FormField, i: number) => {
    const name = names[i]!
    const id = controlId(i)
    const dep = waitsOn(i)
    // A field that depends on a wrong one waits, disabled, and never shows an error of its own.
    const waiting: FieldMessage | undefined =
      dep >= 0 ? { kind: 'helper', text: fieldWords.waiting(field.label, subjectOf(fields[dep]!)) } : undefined
    const disabled = dep >= 0 || field.disabled
    const message = waiting ?? messageOf(i)
    const value = values[name]
    switch (field.component) {
      case 'TextInput':
        return (
          <TextInputField
            id={id}
            field={field}
            value={typeof value === 'string' ? value : ''}
            onChange={next => change(i, next)}
            onBlur={() => blur(i)}
            message={message}
            disabled={disabled}
            readOnly={submitting}
            onRetry={() => submit()}
          />
        )
      case 'Select':
        return (
          <SelectField
            id={id}
            field={field}
            value={typeof value === 'string' ? value : ''}
            onChange={next => change(i, next)}
            onBlur={() => blur(i)}
            message={message}
            disabled={disabled}
            readOnly={submitting}
          />
        )
      case 'FilterChips':
        return (
          <div className={fieldStyles.group} data-field-group="">
            <span id={`${id}-label`} className={fieldStyles.label} data-off={disabled || undefined}>
              {field.label}
            </span>
            <ChipsField
              id={id}
              mode={field.mode}
              options={field.options}
              selected={Array.isArray(value) ? value : []}
              counts={field.counts}
              counting={field.counts === undefined}
              disabled={disabled}
              readOnly={submitting}
              labelledBy={`${id}-label`}
              ariaLabel={chipWords.group(field.filters, field.label)}
              onChange={next => change(i, next)}
            />
          </div>
        )
    }
  }

  return (
    <CardFrame as="div" title={props.title} meta={props.meta} className={styles.card}>
      <form className={styles.form} aria-label={props.title} noValidate onSubmit={submit}>
        <div className={styles.body}>
          {fields.map((field, i) => (
            <div key={names[i]} className={styles.field} data-field={names[i]}>
              {renderField(field, i)}
            </div>
          ))}
        </div>
        <div className={styles.actions} data-failed={failed || undefined}>
          <button
            type="submit"
            className={cx(styles.button, styles.primary)}
            aria-busy={submitting || undefined}
            aria-disabled={submitting || undefined}
          >
            {props.submit}
          </button>
          {props.secondary && (
            <button
              type="button"
              className={styles.button}
              disabled={submitting}
              onClick={props.secondary === 'Cancel' && props.onCancel ? props.onCancel : reset}
            >
              {props.secondary}
            </button>
          )}
          <div ref={effectRef} className={styles.effectSlot} role="status">
            {failed ? (
              <p className={styles.failure}>
                <Mark kind="unavailable" className={styles.failureMark} />
                <span className={styles.failureText}>
                  <span className={styles.ink}>{error?.failed ?? formWords.failed}</span>
                  {error?.cause && <span className={styles.fact}> · {error.cause}</span>}
                </span>
                <TextLink size="hint" onClick={onRetry ?? send}>
                  Try again
                </TextLink>
              </p>
            ) : (
              <span className={styles.effect}>{props.effect}</span>
            )}
          </div>
        </div>
      </form>
    </CardFrame>
  )
}
