import { z } from 'zod'
import { DENSITIES, EMPHASES, TONES, COMPONENT_STATES } from '@genui-github/ui'

// The UI description, exactly as docs/schemas.md defines it. The internal format is the source of truth;
// A2UI is an export of it (a2ui.ts).

export const REGION_NAMES = ['insight', 'metrics', 'main', 'side', 'action'] as const
export type RegionName = (typeof REGION_NAMES)[number]

export const densitySchema = z.enum(DENSITIES)
export type Density = z.infer<typeof densitySchema>
export const toneSchema = z.enum(TONES)
export const emphasisSchema = z.enum(EMPHASES)

export const askSchema = z.object({ label: z.string().min(1).max(40), ask: z.string().min(1).max(160) }).strict()
export type Ask = z.infer<typeof askSchema>

export const errorInfoSchema = z.object({ failed: z.string().min(1), cause: z.string() }).strict()
export const warmingInfoSchema = z
  .object({ counting: z.string().min(1), nextCheck: z.string(), progress: z.number().min(0).max(1) })
  .strict()

/** A piece state other than default. The system sets it; the model never does. */
export const pieceStateSchema = z.enum(COMPONENT_STATES.filter(s => s !== 'default') as ['skeleton', 'empty', 'error', 'warming'])

export const pieceSchema = z
  .object({
    id: z.string().min(1),
    component: z.string().min(1),
    /** The model's choices, validated against the component's registry schema. */
    props: z.unknown(),
    ask: z.string().min(1).max(160).optional(),
    emphasis: emphasisSchema.optional(),
    tone: toneSchema.optional(),
    /**
     * (system) What the component renders: the model's props with the data the system bound to them.
     * Absent while the data is on its way, which renders the skeleton.
     */
    bound: z.unknown().optional(),
    /** (system) A state other than default, with the system's words for it. */
    state: pieceStateSchema.optional(),
    error: errorInfoSchema.optional(),
    warming: warmingInfoSchema.optional(),
    /** (system) Numbers the piece's data holds beyond its bound props, which its prose may cite (a Metric delta's figure). */
    cites: z.array(z.number()).optional(),
  })
  .strict()
export type Piece = z.infer<typeof pieceSchema>

export const builtSchema = z
  .object({
    template: z.string().min(1),
    reason: z.enum(['no template matched', 'change point found', 'follow-up with no template']).optional(),
    model: z.string().min(1),
    tokens: z.object({ input: z.number().int().min(0), cached: z.number().int().min(0), output: z.number().int().min(0) }).strict(),
    costUsd: z.number().min(0),
    latencyMs: z
      .object({
        classify: z.number().min(0),
        data: z.number().min(0),
        compose: z.number().min(0),
        render: z.number().min(0).optional(),
        total: z.number().min(0),
      })
      .strict(),
    githubReads: z.number().int().min(0),
    chose: z.array(z.string()),
  })
  .strict()
export type Built = z.infer<typeof builtSchema>

export const regionsSchema = z
  .object({
    insight: z.array(pieceSchema),
    metrics: z.array(pieceSchema),
    main: z.array(pieceSchema),
    side: z.array(pieceSchema),
    action: z.array(pieceSchema),
  })
  .strict()
export type Regions = z.infer<typeof regionsSchema>

export const compositionSchema = z
  .object({
    id: z.string().min(1),
    density: densitySchema,
    regions: regionsSchema,
    asks: z.array(askSchema).max(4),
    built: builtSchema,
  })
  .strict()
export type Composition = z.infer<typeof compositionSchema>

export const streamOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('start'), id: z.string().min(1), density: densitySchema, asks: z.array(askSchema).max(4) }).strict(),
  z.object({ op: z.literal('add'), region: z.enum(REGION_NAMES), piece: pieceSchema }).strict(),
  /** Live data under the same composition: `props` replaces the piece's bound props. The model's choices do not change without a rewrite. */
  z.object({ op: z.literal('update'), id: z.string().min(1), props: z.unknown() }).strict(),
  z.object({ op: z.literal('remove'), id: z.string().min(1) }).strict(),
  z.object({ op: z.literal('done'), built: builtSchema }).strict(),
  z.object({ op: z.literal('error'), reason: z.string().min(1) }).strict(),
])
export type StreamOp = z.infer<typeof streamOpSchema>

export function emptyRegions(): Regions {
  return { insight: [], metrics: [], main: [], side: [], action: [] }
}

/** Every piece in reading order: region by region, top to bottom, then left to right. */
export function piecesOf(regions: Regions): { region: RegionName; piece: Piece; index: number }[] {
  return REGION_NAMES.flatMap(region => regions[region].map((piece, index) => ({ region, piece, index })))
}

/** The composition as a stream of ops, the shape the composer route sends. */
export function toStream(composition: Composition): StreamOp[] {
  return [
    { op: 'start', id: composition.id, density: composition.density, asks: composition.asks },
    ...piecesOf(composition.regions).map(({ region, piece }): StreamOp => ({ op: 'add', region, piece })),
    { op: 'done', built: composition.built },
  ]
}
