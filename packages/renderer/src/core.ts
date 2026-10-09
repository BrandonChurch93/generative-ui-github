// The renderer without React: the format, the stream parser, validation, the diff and the plan. For Node.
export * from './format'
export { applyOp, createStreamParser, emptyTree, parseLine, toComposition, type ParsedLine, type StreamParser, type StreamTree } from './stream'
export { applyRules, PIECE_ERRORS, SYSTEM_COMPONENTS, validatePiece, validateRegions, type RenderNode, type Screen, type ValidateOptions } from './validate'
export { toScreen } from './screen'
export { diff, sameNode, type Diff, type DiffEntry } from './diff'
export { fromA2UI, toA2UI } from './a2ui'
export { plan, EXIT_LEAD, INSIDE_DELAY, PIECE_STAGGER, REGION_STAGGER, type Cue, type CueAction, type Plan } from './choreography'
