# Metric

> Build note (from `docs/schemas.md`, which wins on who supplies what): the model sends `measure`, `label`, `window`, `scope`, `delta`, `hot`, `trend`; the system binds `value`, `suffix` and `format` from the measure catalog.

One number that answers part of the question, with its label above, its delta below and an accent bar that extends along the bottom edge on arrival.

- The number is the `metric` style, tabular, one decimal at most: 30px compact, 38px comfortable, 46px spacious. Tabular figures stay on because the number counts up on arrival, and proportional figures would jitter while it counts.
- A unit or denominator goes after the number in the mono `suffix` style, `muted`, baseline aligned, `space-2` after it: 12px, 14px or 16px by density.
- The label is the `label` style in `muted`, sentence case, one line with ellipsis. Never uppercase. `space-1` sits between it and the number.
- The delta is `meta` in muted, or in `crit` / `good` when the model marks the tone. It sits `space-2`, `space-3` or `space-4` below the number by density.
- Padding follows the density table. The bottom padding adds the bar's 3px so the content sits evenly above it.
- The bar is 3px, `accent` to `accent-2` left to right. Its left end is square and sits under the card's corner curve, so it reads as coming out of the edge. Its right end stops on the content edge with a round cap. It never runs the full width, which would read as a border.
- `hot` is the model saying this number is blocking: a `crit-fill` border at 35%, the `card-hot` shadow and a filled crit mark in the top right corner, with a visually hidden "Blocking." so the state is never carried by color alone. At most two hot metrics per screen.
- Skeleton: `line-soft` blocks at the real line heights, so nothing shifts when the value lands. No bar until then; it extends on arrival.
- Empty, error and warming put a 14px message in the number's slot at the number's height, so a row of metrics stays level. Empty: neutral mark, muted message, the window in the delta row, no bar. Error: unavailable mark, message in ink, cause in meta, Try again on the right. Warming: warming mark, muted message, and the bar's track appears in `line-soft` while its fill extends as GitHub finishes.
- Optional `trend`: twelve weekly points and a one-line finding. It renders a Sparkline in the number's row, bottom on the baseline, in the room left beside the number up to 120px; under 56px it drops. The card's height never changes, so a row of metrics stays level. See Sparkline.
- A zero is data, not empty. Zero failing checks renders as the number 0.
- Enter: rise, bar extends, number counts. Exit: bar retracts, card sinks. Morph: number counts old to new, delta crossfades, position moves with Flip.
- Clickable when it carries a follow-up question; the whole card is the target.

The full sheets live in the [Metric component](https://claude.ai/artifact/TXC5ZhgUNtxTxpL4FFAKym) canvas: densities and states, then empty, error and warming.
