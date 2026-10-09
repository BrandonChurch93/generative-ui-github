'use client'

import { useId, useState, type FormEvent } from 'react'
import { CardFrame } from '../../parts'
import type { PieceRenderProps } from '../../types'
import { MessageSlot } from './MessageSlot'
import { checkValue, fieldWords, messageFor, type FieldMessage, type FieldStatus, type Problem, type TextInputProps } from './schema'
import styles from './TextInput.module.css'

export interface TextInputFieldProps {
  id: string
  field: Pick<TextInputProps, 'label' | 'placeholder' | 'kind' | 'required'>
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  message?: FieldMessage
  disabled?: boolean
  readOnly?: boolean
  onRetry?: () => void
}

const identifierAttrs = { spellCheck: false, autoCapitalize: 'none', autoComplete: 'off' } as const

/** The bare field group (label, field, message slot) that a Form lays out on its own surface. */
export function TextInputField({ id, field, value, onChange, onBlur, message, disabled, readOnly, onRetry }: TextInputFieldProps) {
  const messageId = `${id}-message`
  const checking = message?.kind === 'checking'
  return (
    <div className={styles.group} data-field-group="">
      <label htmlFor={id} className={styles.label} data-off={disabled || undefined}>
        {field.label}
        {field.required === false && <span className={styles.optional}> {fieldWords.optional}</span>}
      </label>
      <input
        id={id}
        type="text"
        className={styles.control}
        data-kind={field.kind}
        value={value}
        placeholder={field.placeholder}
        disabled={disabled}
        readOnly={readOnly || checking}
        aria-invalid={message?.kind === 'invalid' || undefined}
        aria-busy={checking || undefined}
        aria-required={field.required !== false || undefined}
        aria-describedby={messageId}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        {...(field.kind === 'identifier' ? identifierAttrs : {})}
      />
      <MessageSlot id={messageId} message={message} onRetry={onRetry} />
    </div>
  )
}

interface HeroFieldProps {
  id: string
  value: string
  placeholder?: string
  action: string
  message?: FieldMessage
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onRetry?: () => void
}

/** The landing page's paste-a-repo field: one size at every density, the primary nested inside. */
function HeroField({ id, value, placeholder, action, message, disabled, onChange, onSubmit, onRetry }: HeroFieldProps) {
  const messageId = `${id}-message`
  const checking = message?.kind === 'checking'
  const invalid = message?.kind === 'invalid'
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!checking && !disabled) onSubmit()
  }
  return (
    <form className={styles.hero} onSubmit={submit} noValidate aria-busy={checking || undefined}>
      <label className="sr-only" htmlFor={id}>
        {fieldWords.heroLabel}
      </label>
      <div className={styles.heroBox} data-invalid={invalid || undefined} data-off={disabled || undefined}>
        <input
          id={id}
          type="text"
          inputMode="url"
          className={styles.heroInput}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={checking}
          aria-invalid={invalid || undefined}
          aria-describedby={messageId}
          onChange={e => onChange(e.target.value)}
          {...identifierAttrs}
        />
        <button type="submit" className={styles.heroButton} aria-disabled={checking || disabled || undefined}>
          {action}
        </button>
      </div>
      <MessageSlot id={messageId} message={message} onRetry={onRetry} className={styles.heroSlot} />
    </form>
  )
}

/**
 * A field shown on its own: in the catalog inside a card, and as the landing page's hero. A composed screen only
 * ever shows TextInput inside a Form.
 */
export function TextInput({ props, state, error, onRetry }: PieceRenderProps<TextInputProps>) {
  const id = useId()
  const [value, setValue] = useState(props.value ?? '')
  const [problem, setProblem] = useState<Problem>()
  // A verdict from GitHub is about the value it checked; once the reader edits, it no longer applies.
  const [editedOver, setEditedOver] = useState<FieldStatus>()
  const status = props.status !== editedOver ? props.status : undefined

  const change = (next: string) => {
    setValue(next)
    setProblem(undefined)
    setEditedOver(props.status)
  }
  const check = () => {
    const found = checkValue(props.validate, value, props.required !== false)
    setProblem(found)
    return found
  }

  let message: FieldMessage | undefined
  if (state === 'error') {
    message = { kind: 'unreachable', failed: error?.failed ?? fieldWords.unreachable(props.validate), cause: error?.cause ?? '' }
  } else if (problem) {
    message = { kind: 'invalid', text: fieldWords.problem(problem, props) }
  } else {
    message = messageFor(props, value, status)
  }

  if (props.size === 'hero') {
    return (
      <HeroField
        id={id}
        value={value}
        placeholder={props.placeholder}
        action={props.action ?? fieldWords.heroAction}
        message={message}
        disabled={props.disabled}
        onChange={change}
        onSubmit={() => {
          if (!check()) props.onSubmit?.(value.trim())
        }}
        onRetry={onRetry}
      />
    )
  }

  return (
    <CardFrame as="div">
      <div className={styles.body}>
        <TextInputField
          id={id}
          field={props}
          value={value}
          onChange={change}
          // Standing alone there is no submit, so blur checks only what was typed.
          onBlur={() => value.trim() && check()}
          message={message}
          disabled={props.disabled}
          onRetry={onRetry}
        />
      </div>
    </CardFrame>
  )
}
