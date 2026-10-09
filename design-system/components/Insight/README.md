# Insight

The one sentence the model writes about the data, with a gradient rule on its left and a source line naming what it was computed from.

- The sentence is the `insight` style in `ink`, weight 500: 16px compact, 19px comfortable, 22px spacious. Max 60ch, two lines at most, `text-wrap: pretty` so no word sits alone on the last line. The schema caps it at 120 characters so it never reaches a third line.
- Identifiers (branches, job names, files) go in mono at 0.85em, weight 500, in ink. No chip and no tint.
- The source line is mandatory and sits under the sentence in `meta`, `muted`: the reader always sees what the sentence rests on. Gap below the sentence is `space-1`, `space-2` or `space-3` by density.
- The rule is 3px, `accent` to `accent-2` top to bottom, with round ends. It runs from the sentence's cap height to the source line's baseline, so claim and evidence read as one unit.
- The rule sits on the card edge of the column and the text starts at the density's side padding plus the 1px card border (17, 21 or 29px). The sentence starts exactly where every card's content starts below it.
- Skeleton: two `line` blocks and a source block at real line heights. It sits on `bg`, so it uses `line`, not `line-soft`. No rule until the sentence lands.
- Nothing notable: the model looked and found nothing. A real sentence in ink with its source, and a solid `muted` rule. Never a blank region.
- Error: a plain sentence in ink, the cause in meta and Try again in `accent-text` beside it. Muted rule, no crit.
- Warming (the GitHub 202 wait): the sentence in muted says what it is waiting for, meta says when it will check again, and the rule's `line` track fills top to bottom with the gradient as progress.
- Enter: the sentence wipes left to right and the rule draws top to bottom. Exit: wipe out left to right as the next insight wipes in behind it. Reduced motion shows the final state with a 200ms fade.
- Always the first content piece on a composed screen.

The full sheets live in the [Insight component](https://claude.ai/artifact/UUtfzsGqvLBYc6YZL7B6dN) canvas: densities and states, then nothing notable, error and warming.
