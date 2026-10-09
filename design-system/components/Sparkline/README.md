# Sparkline

> Build note (from `docs/schemas.md`, which wins on who supplies what): a Metric sets `trend: true`; the system supplies the 12 points and the aria phrase from the measure's series. The model never sends points.

The inline trend beside a number: 12 weeks as a 2px line in `data-ref` with the latest week and its endpoint in `accent`, no axes, inside a Metric or a list row.

- The composer never picks Sparkline on its own. It is offered as the `trend` prop on Metric and on list rows (StatusList and the rows that reuse its part), the same way `StatusList.Row` is a part. The model adds a trend when the direction matters as much as the value: "is CI getting slower" wants 18.4 min with its climb beside it. When the shape is the whole answer, it picks a LineChart instead.
- Schema the model reads: `trend` with `points` (12 weekly values, oldest first, the last one the value shown beside it) and `finding` (a short phrase for the aria-label, such as "Up from 13.2 to 18.4 minutes over 12 weeks"). The model never sends a color, a scale, a width or a height.
- The system decides: the scale, the size, where the slot sits, when it drops, and the state drawing.
- Line: 2px, `data-ref`, round joins and caps, one point per week, oldest on the left.
- Latest: the last segment and the endpoint in `accent`, so the eye lands on now. The rest stays `data-ref`. The accent here is the model's choice in the same sense as a chart line: it marks the value the card is about.
- Endpoint: a 6px `accent` dot with a 2px `surface` ring. Its right edge sits on the slot's right edge, which in a Metric is the content edge. 6px, not the chart's 8px, because at 24px tall an 8px dot reads as a second mark.
- Scale: its own 12 points from lowest to highest, never from zero, because the number beside it carries the size. The span is never less than 25% of the latest value, so a steady series stays steady instead of being stretched into noise (lint-and-types holds near 3.2 min and draws as a calm band).
- Box: 24px compact, 28px comfortable, 32px spacious, with 3px inside top and bottom for the line and the dot. It is never taller than its host's number or row, so adding a trend never changes a card's height.
- In a Metric: inside the number's row, after the number and suffix, its bottom on the number's baseline. It takes the room left after the number and suffix less `space-4`, up to 120px. Below 56px it drops and the delta carries the trend in words. The Metric's label, delta and bar are unchanged.
- In a row: an 80px slot between the title block and the value, `space-3` either side, vertically centered in the row. The value after it is the latest point in the `tag` style, `ink`, right-aligned in 56px, so trends and values line up down the list.
- Never: axes, labels, gridlines, area fill or hover. The value beside it is the reading; the aria-label says the trend in words.
- Skeleton: a `line-soft` block the size of the slot (in a Metric, the number block's height), beside the host's own blocks. No line, no accent.
- The sparkline's own states are for when the host has its value and only the trend is missing. When the host itself is empty, failed or warming, the host's message takes the number's row or the row, and the slot draws nothing.
- Empty (the value exists but no week has closed yet): a flat 2px `line-soft` baseline on the floor of the slot holds the column. The delta or meta says when the first point lands. A zero is data: 12 weeks of 0 draw a flat line in `data-ref` with the accent end.
- Error (only the trend failed): the unavailable mark at the slot's center, the cause in words in the delta or meta ("trend unavailable"), and in a Metric, Try again in `accent-text` in the delta row with the `focus` ring on keyboard focus. Never `crit`.
- Warming (GitHub 202 on the weekly stats while the value is in): the baseline fills in `accent` over a `line-soft` track as GitHub counts, the progress idiom of the Metric bar at 2px, and the delta says "GitHub is counting the trend".
- Enter: the host arrives first; the line draws left to right (draw, 1100ms, `power2.inOut`). The endpoint marks the latest week, so it is the one point that bounces: it pops with `back.out(2)` as the draw lands. Exit: the line erases right to left (500ms) and the dot goes with it.
- Update: the path morphs to the new 12 weeks over 800ms (`power2.out`) and the dot travels with the end, no second pop. A warming baseline that becomes data hands off: the track erases as the line draws over it.
- Morph (survives a rewrite): the slot resizes with the host's Flip and the path redraws to its new width without a pop.
- Accessibility: the SVG is `role="img"` with the model's trend phrase as its `aria-label`; flat and warming baselines are `aria-hidden` because the host's words carry the state; the unavailable mark pairs with visually hidden text. A table view is available through the host: the Metric or list exposes the 12 weeks as a visually hidden table. Contrast on `surface`: `data-ref` 3.30:1 (3.06:1 on `surface-tint`) and `accent` 4.84:1, both above the 3:1 floor for marks; Try again in `accent-text` 5.38:1. Reduced motion collapses the draw and pop to a 200ms opacity change.

The full sheet lives in the [Generative UI components](https://claude.ai/artifact/Y1VwMbCVASqupxjZ8k3mLK) canvas, page Sparkline.
