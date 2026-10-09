# Generative UI

Model decides, code renders. This is the system a composer agent builds screens from: every component here is a piece the model may pick, so every piece has to look finished at any density, in any combination, arriving in any order.

## Principles

1. **Nothing appears without a cause.** Every piece enters by draw, wipe, extend, slide, count, or bloom. Nothing fades in from nowhere, chrome included.
2. **Every enter has a reverse.** A rewrite runs exits just ahead of entrances, top to bottom. Pieces that survive a rewrite morph in place; only the dropped ones leave.
3. **The model chooses meaning, never values.** The composer sets `tone`, `emphasis` and `density`. This system decides what those look like. No raw color, size or spacing ever crosses from the model to the screen.
4. **Warm, light, quiet.** One coral accent, one violet that only ever ends a gradient, semantic color for states. Everything else is warm ink on warm white.
5. **Two tokens per state color.** A `-fill` for marks (3:1 minimum against surface) and a text token a shade deeper. Text is measured against the darkest ground it can sit on, its own 10% tag tint over `surface-tint`, and holds 4.5:1 there. Marks stay bright, words stay readable.
6. **No em dashes.** Anywhere in chrome, copy, labels or tags. Interpuncts (·) separate facts; periods end sentences.

## Foundations

**Ground and surfaces.** `bg` is the page; `surface` is every card. Cards are set off by `radius-lg`, the `card` shadow and a `line-soft` border. `surface-tint` is the only other ground, used inside a card for the action area and for a selected chip.

**Type.** Plus Jakarta Sans for everything read; JetBrains Mono for everything counted, timestamped or identified (numbers in text stay sans, tabular). Weights: 700 for the question and metric numbers, 600 for card titles and action headings, 500 for labels, row titles and the insight, 400 for body and meta. Labels are sentence case; nothing is uppercase.

**Accent.** `accent` marks what the model chose: the insight rule, metric bars, chart lines, the primary button, a selected chip. The gradient `accent` to `accent-2` runs left to right on bars and top to bottom on the insight rule. `accent-2` never appears alone. When the accent has to be read as words (links, Try again, Show all) it uses `accent-text`, a shade deeper, because plain accent falls to 4.49:1 on `surface-tint`.

**Data color.** Charts follow the same discipline. `data-1` (the accent) is the series the story is about; `data-2` slate is the second series, validated for color-blind separation; `data-ref` warm gray is a previous period or a reference. Never more than two categorical series. A series that means failure wears `crit-fill`. Magnitude uses the five-step `heat` ramp in one coral hue with `heat-0` for nothing. Text never wears a series color: a colored key beside the words carries identity. One y axis, always.

**Focus and hover.** Keyboard focus is a 2px `focus` ring at a 2px offset on every interactive element. It is warm near-ink, never accent, because a coral ring reads as an error border. A clickable row lifts onto `surface-tint` as an inset rounded shape (`radius-md`, `space-2` in from the card edge) and the hairlines beside it hide. Cards that are links lift with `card-hover`. Tooltips are `surface`, `radius-md` and the `card` shadow, value first.

**State color.** Three states, each a pair, plus neutral for lists with nothing to show:

| State | Text | Mark | Where |
| --- | --- | --- | --- |
| good | `good` | `good-fill` | approved, passed, positive delta |
| warn | `warn` | `warn-fill` | review pending, aging, timeouts |
| crit | `crit` | `crit-fill` | changes requested, failing, blocking |
| neutral | `muted` | `muted` | an empty list that means nothing yet, not nothing wrong |

`crit` is crimson, 20° cooler in hue than the coral accent and a step deeper, so a failing mark never reads as something the model chose. A tag is text color on a 10% tint of itself. A mark is a 10px dot: outlined for good, dashed outline for warn, filled for crit, outlined in `muted` for neutral, outlined in `muted` with a slash for unavailable, and a `line` ring with an `accent` quarter arc for warming. Fill and text never swap roles.

**Density.** Three levels, set once on the screen root by the composer, never per component. Every component reads them; nothing is rebuilt when they change.

| Token role | compact | comfortable | spacious |
| --- | --- | --- | --- |
| side padding (cards and rows) | `space-4` | `space-5` | `space-6` |
| card top and bottom | `space-3` | `space-4` | `space-5` |
| row top and bottom | `space-2` | `space-3` | `space-4` |
| region gap | `space-4` | `space-6` | `space-7` |
| metric number | 30px | 38px | 46px |
| metric suffix | 12px | 14px | 16px |
| insight | 16px | 19px | 22px |

Side padding is one value per density, shared by every card and every row, so content edges line up down a column however the composer stacks pieces.

**States.** Every component ships the same five, drawn the same way everywhere. The frame always renders (card, header, label), so the reader knows what is loading, missing or failed.

| State | Mark | Words | Accent |
| --- | --- | --- | --- |
| default | from the data | the component's own | its bar, rule or line extends on arrival |
| skeleton | none | `line-soft` blocks at real line heights on `surface`, `line` blocks on `bg`; charts preview their own geometry (gridlines, bar silhouettes, row bars) | none until data lands |
| empty | neutral or good, by `emptyTone` | a real sentence in the component's rhythm, never a blank region | none |
| error | unavailable | what failed in ink, the cause in `meta`, Try again in `accent-text` | none |
| warming | warming | what GitHub is counting in `muted`, when it will check again in `meta` | the 3px bottom bar (or the Insight rule) fills as progress |

Two rules hold across all of them: a zero is data, not empty, and `crit` is reserved for data that blocks or reads as worse. A failed request is never `crit`. A state that cannot happen for a component (an input never waits on a GitHub 202) is left out, and its README says why. Charts keep their full height in every state, so a row of charts never jumps.

**Hairlines.** `line` for rules that draw in (row underlines, chip borders). `line-soft` for rules that sit still (card borders, chart grid). A hairline is 1px; a bar is 3px; a rank bar is `space-2`.

**Cursor warmth.** A fixed radial gradient follows the pointer: `glow-a` inner, `glow-b` at 45%, transparent by 72%, 560px across. It fades in on first move and out when the pointer leaves. It is the only thing on the page that is not caused by the data.

## Motion grammar

Every component ships four choreographies: enter, exit, update and morph. Enter and exit are strict reverses. Details, timings and easing in `motion.md`.

## Component anatomy

Every component, before it is finished:

- A Zod schema the model reads: props, allowed enums, one-line description of when to choose it.
- States: default, skeleton, empty, error, warming (the GitHub 202 wait).
- Three densities, from one CSS module reading the density attribute.
- Enter, exit, update and morph choreography in a `motion.ts` next to it.
- A sample JSON the catalog page renders it from.
- Text 4.5:1, marks 3:1, focus ring visible, reduced motion respected.

Motion (Framer) owns the wrapper: presence and layout. GSAP owns the guts: what draws, counts, extends or wipes inside. Neither touches the other's element.

## Accessibility

Contrast is verified per token in the usage notes. Reduced motion collapses every choreography to a 200ms opacity change and skips the cursor warmth. Every interactive card and row is a button or link with a visible 2px `focus` ring at a 2px offset. Charts carry an `aria-label` that states the finding, not the chart type, and every chart has a table view, so no value lives only in a tooltip or a color. State is never carried by color alone: every state has a text tag and a mark shape.

## Sample data

- The catalog page renders every component from its sample JSON. People in sample JSON get anonymized, handle-shaped placeholder names; repo names are real and stay.
- The app itself shows only live GitHub API data. Nothing from sample JSON ever reaches a composed screen.
