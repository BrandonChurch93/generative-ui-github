# Motion

The house curve is `cubic-bezier(.25, 1, .5, 1)` (GSAP `power3.out`) for arrivals and `power3.inOut` for anything that travels across itself (wipes, extends, draws). Exits use `power2.in`. Nothing bounces except the single point a component marks as the latest or the peak (`back.out(2)`): a chart's endpoint dot, the Timeline's newest node, the Heatmap's peak dot. One per component, never more. The WarmingUp lanes are the one linear motion in the system, because they are a clock.

## The six moves

| Move | What it does | Duration | Used by |
| --- | --- | --- | --- |
| wipe | Reveals text left to right behind a clip; exits the same direction, like a line being retyped | 900ms in · 500ms out · `power3.inOut` | question, insight, any sentence the model wrote |
| extend | A bar or hairline grows from its left end; retracts to the left on exit | 700ms in · 350ms out · `power3.inOut` | metric bars, row underlines, rank bars, chip borders |
| slide | A row arrives from 10px left with opacity; leaves the same way | 500ms in · 350ms out · 70ms stagger | list rows, chips, eyebrow items |
| draw | A path draws along its length; erases back on exit | 1100ms in · 500ms out · `power2.inOut` | chart lines, sparklines, the insight rule |
| count | A number runs from its previous value to the new one, tabular, one decimal at most | 800ms · `power2.out` | metric numbers, the latency figure, percentages |
| bloom | Warmth rises behind a piece and settles back | 700ms up · 700ms down · `power2.out` | cards the model flagged, the action card on arrival |

Container pieces (cards) arrive with a 10px rise and opacity over 550ms, then their contents run their own moves inside. A card never scales.

## Entrance

The screen composes top to bottom, each region starting 160ms to 200ms after the one above, so the reader has the answer before the detail:

1. Chrome: eyebrow chips slide, the question wipes, the built block rises, the question chips slide.
2. Insight wipes.
3. Metrics rise left to right (80ms apart); each bar extends and each number counts.
4. The main card rises; its rows slide and their hairlines extend, top to bottom.
5. The chart card rises; bars grow from the baseline, the line draws, the endpoint pops.
6. The action card rises and blooms.
7. The strip wipes; the latency figure counts.

Total time to a complete screen: about 2.4 seconds. Time to the answer (insight visible): under one second.

## Rewrite

A rewrite is a new composition replacing the current one after a click or a new question.

- Diff by stable id. Pieces in both compositions survive; pieces only in the old one exit; pieces only in the new one enter.
- Exits run just ahead of entrances, region by region, top to bottom. The old insight wipes out as the new one wipes in behind it. Old rows slide out left; new rows slide in from the left. Old bars retract; new bars extend.
- Survivors morph in place: a metric's number counts from old to new, its delta crossfades, its position moves with a layout transition (Flip), never a remount. A surviving chart re-emphasizes rather than redraws.
- A new question during a rewrite kills the running timeline and starts the next rewrite from wherever the screen is. Two timelines never run at once.
- The header follows the same rule: the question wipes out and in; the latency figure resets and counts again.

## Update

Live data changing under a composition that is not being rewritten: numbers count, bars extend or retract to the new length, a new row slides into place while its neighbors move with Flip. No exits, no rises.

## Reduced motion

Every move collapses to a 200ms opacity change. Counts jump to the final value. The cursor warmth is off. The composition order and timing offsets are kept so the screen still reads top to bottom.
