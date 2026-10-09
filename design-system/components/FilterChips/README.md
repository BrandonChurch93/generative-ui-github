# FilterChips

A row of pill toggles that narrows the list or chart it sits above, each chip carrying a count of what it would show.

- The composer picks FilterChips when a list or chart on the screen has a few slices the reader may want to narrow to: states, areas, labels, a time window. It sits directly above its target, on the page ground, with the pill edges on the card edges below. Inside a Form it is a field like any other, with a label above.
- Schema: `target` (the id of the component it filters), `mode` (`single` or `multi`), `options` (each a `value` and a `label`), `selected`, and a `label` only inside a Form. The model chooses the slices and the starting selection. Counts are computed by code from the target's data, never written by the model.
- Chip: `radius-pill`, 1px `line` border, `surface`, 28, 32 or 36px by density, text inset `space-3`, `space-3`, `space-4`. Label 13px, weight 500, `muted` (5.90:1). `space-2` between chips and between a label and its count.
- Chosen: `surface-tint`, a full `accent` border (4.49:1 on surface-tint, 4.65:1 on bg, over the 3:1 a selected-state indicator needs; the same border the shell uses on selected chips and segmented options), the label in `ink`, and a 12px check in `accent` ahead of the label. Border and check carry the state; the tint only confirms it.
- Count: `tag` style, 11px mono, weight 500, `muted` (5.48:1 on surface-tint). A zero stays visible and the chip stays enabled: a zero is data.
- Single: exactly one chosen, radio semantics, used for windows and mutually exclusive states. Multi: any number chosen, toggle semantics, and none chosen means no filter.
- Hover: the label lifts to `ink` and the border deepens to `line-strong`. Focus: the 2px `focus` ring at 2px offset, never accent.
- Overflow: always one line, measured. What does not fit goes behind a "+N more" chip with no fill, a `line` border, `ink` text and N in mono. Chosen chips are pulled forward and never hide. It opens in place onto further lines and the last chip becomes "Show less". How many hide can differ by density, because the line is measured.
- Counts loading: labels render at once (they come with the schema); counts are `line-soft` blocks until the target's data lands, with `aria-busy` and one visually hidden sentence. While the target is warming the chips stay like this; the warming message lives on the target card, not here.
- Disabled: no fill, `line-soft` border, `muted`; a chosen chip keeps its check and tint. Used while the target rewrites.
- Empty and error are not drawn: a filter with no slices is never composed, and when the target fails the counts drop out, the chips disable, and the target card owns the error.
- Motion: chips slide in from the left 60ms apart, like the Ask chips, and leave the same way. Choosing crossfades tint and border in 150ms while the check extends in from zero width in 200ms (`power3.out`) and the neighbors move with Flip. Counts count on update. Opening the overflow slides the new chips in 60ms apart. Nothing bounces. Reduced motion keeps the check and drops the movement for a 200ms opacity change.
- Accessibility: single is a `radiogroup` of `role="radio"` buttons with one tab stop and arrow keys; multi is a `group` of toggle buttons with `aria-pressed`. Every group has an `aria-label` that names what it filters ("Filter v16.2 pull requests by area"), and the count is part of each chip's name ("Turbopack, 3"). "+N more" carries `aria-expanded`. At spacious and on any coarse pointer an invisible layer makes each chip 44px tall to touch while the pill stays 36px.

The full sheet lives in the [Generative UI components](https://claude.ai/artifact/Y1VwMbCVASqupxjZ8k3mLK) canvas, page Inputs-States.
