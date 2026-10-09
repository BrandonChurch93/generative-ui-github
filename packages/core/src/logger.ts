export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

export type LogFields = Record<string, unknown>

export interface Logger {
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  child(scope: string): Logger
}

export interface LogRecord {
  level: LogLevel
  scope: string
  message: string
  fields?: LogFields
  time: string
}

export type LogSink = (record: LogRecord) => void

/* eslint-disable no-console -- the logger is the one place allowed to write to the console */
const consoleSink: LogSink = record => {
  const { level, scope, message, fields } = record
  const line = `[${scope}] ${message}`
  const out = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error
  if (fields) out(line, fields)
  else out(line)
}
/* eslint-enable no-console */

function parseLevel(value: string | undefined): LogLevel {
  return LOG_LEVELS.find(l => l === value) ?? 'info'
}

export interface LoggerOptions {
  level?: LogLevel
  sink?: LogSink
}

export function createLogger(scope: string, options: LoggerOptions = {}): Logger {
  const level = options.level ?? parseLevel(process.env.LOG_LEVEL)
  const sink = options.sink ?? consoleSink
  const threshold = LOG_LEVELS.indexOf(level)

  const emit = (l: LogLevel, message: string, fields?: LogFields) => {
    if (LOG_LEVELS.indexOf(l) < threshold) return
    sink({ level: l, scope, message, fields, time: new Date().toISOString() })
  }

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: child => createLogger(`${scope}:${child}`, { level, sink }),
  }
}

export const logger = createLogger('genui')
