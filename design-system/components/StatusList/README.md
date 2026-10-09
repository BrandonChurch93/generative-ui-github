# StatusList

> Build note (from `docs/schemas.md`, which wins on who supplies what): the model sends `kind`, `scope`, `sort`, `limit`, `emptyTone` and `empty`; the system fetches the items and sets each item's `state`. The schema line below describes the items the component receives, which the system fills.

A titled list of items, each carrying a state the model picked, in the mark, title, meta, size and tag rhythm every list in the system shares.

- The composer picks StatusList, never a single row. Its schema: `title`, optional `meta`, `items`, `emptyTone` and an `empty` line. `StatusList.Row` is a part: reused in code by Timeline and ActivityFeed, never offered to the model on its own.
- Each item's `state` is a fixed enum: `pending`, `changes`, `failing`, `approved`. The system maps it to the mark, the tone and the tag wording (review pending, changes requested, checks failing, approved). The model never writes tag text, so the same state always reads the same.
- Row: a 10px mark centered on the title line; the title in `row-title`, one line, ellipsis; the meta line in `meta`, `muted`, interpuncts between facts; an optional size count in the `tag` style, additions in `good`, deletions in `crit`; the tag in the `tag` style, state text on a 10% tint of itself, centered in the row.
- Marks carry state as shape: outlined `good-fill` for good, dashed `warn-fill` for warn, filled `crit-fill` for crit, outlined `muted` for neutral.
- Padding: side padding is the density's shared value (`space-4`, `space-5`, `space-6`), so the header, the rows and every card above or below share one left edge. Rows take `space-2`, `space-3` or `space-4` top and bottom. The header takes the card's top padding and the row padding below.
- Hairlines: `line`, 1px, inset to the side padding, between rows only. The header rule is `line-soft`, full width.
- Empty: one row in the same rhythm, no size, no tag. `emptyTone` is the model's call: `good` when an empty list means nothing is wrong (no failing checks), `neutral` when it means nothing to show yet (no releases).
- Skeleton: `line-soft` blocks at the real line heights, three rows, no hairlines until rows land.
- Error: the header still renders, then one row with the unavailable mark, the failure in ink, the cause in meta and Try again in `accent-text` where the tag would sit. Never `crit`; crit is for data that blocks.
- Warming (the GitHub 202 wait): the header renders, then one row with the warming mark, a muted line naming what GitHub is counting and when it will check again. The card's bottom edge fills with the accent gradient as progress, the same 3px as a Metric bar.
- Enter: card rises, rows slide in from the left 70ms apart, hairlines extend. Exit is the reverse. Update: a new row slides into place while its neighbors move with Flip.
- A row is a button or link when its item carries a follow-up question. The whole row is the target. Hover lifts it onto `surface-tint` as an inset rounded shape and hides the hairlines beside it; keyboard focus is the 2px `focus` ring.

The full sheets live in the [StatusList component](https://claude.ai/artifact/V3zJBX5tFEn58zFdGE61RV) canvas: densities and states, then error and warming.
