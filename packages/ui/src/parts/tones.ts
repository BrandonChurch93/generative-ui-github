// Plain data, so schemas and the registry can name tag tones without reaching a React module.
export const TAG_TONES = ['good', 'warn', 'crit', 'quiet'] as const
export type TagTone = (typeof TAG_TONES)[number]
