# Dark theme brief

For a designer joining at the dark theme. You know design systems and contrast; you have not seen this codebase. Everything you need is here, with the file each figure comes from. Every figure quoted below was measured on the light theme. None has been measured on dark yet: where this brief says "needs measuring", nobody has a number for it.

Task 8.1 in `docs/plan.md`. The build picks your values up in task 9.0, and its bar is that `pnpm a11y` on `/catalog` in dark reports zero contrast failures.

## 1. The system, and what dark must keep

Generative UI for GitHub Repos composes a screen of cards (metrics, lists, charts, a diff, a form) around a question about a public repo. A model picks the components and their meaning (`tone`, `emphasis`, `density`). The system decides every color, size and word. The visual direction is "Blend": light, rounded and warm, one coral accent, a violet that only ever ends a gradient, and semantic color for states. Everything else is warm ink on warm white. Every component reads its colors from tokens only, so a dark theme is a second set of token values and nothing else.

A dark theme must keep these, unchanged:

- **Meaning by tone.** `good`, `warn` and `crit` mean the same thing in both themes. Each is a pair: a text token for words and a `-fill` token for marks. A state is never carried by color alone; every state also has a tag word and a mark shape (outlined for good, dashed for warn, filled for crit, outlined `muted` for neutral, outlined `muted` with a slash for unavailable, a `line` ring with an `accent` quarter arc for warming).
- **The accent marks what the model chose.** The Insight rule, Metric bars, chart series 1, the primary button, a selected chip. It must never be confused with `crit`.
- **The two left edges.** Chrome (wordmark, card borders, the Insight rule, the strip rule) sits on the container edge. Everything read sits on the content edge, side padding plus 1px. Nothing in the dark theme moves either edge; this is geometry, so it holds as long as no size token changes.
- **Contrast minimums.** Text 4.5:1. Marks, bars, rings and selected-state indicators 3:1. Text is measured on the ground nearest to it in luminance that it can sit on. In light that is "its own 10% tag tint over `surface-tint`" (`design-system/README.md`, principle 5). In dark it is still that tint, which is now the lightest ground a state word sits on.
- **The focus ring.** 2px, 2px offset, the `focus` token, on every interactive element. Never accent, because a coral ring could not be told from a `crit-fill` error border (`design-system/decisions.md`, System).
- **Error is never crit.** A failed request shows the unavailable mark in `muted`. `crit` is for data that blocks or reads as worse.
- **A zero is data.** Zero counts are drawn in `muted`, because a red zero reads as a deletion.

## 2. Every token, and whether it needs a dark value

Source: `design-system/tokens.json` (generated into `design-system/tokens.css`). "Light figure" is quoted from the token's usage note unless another file is named.

### Color

| Token | Light | Job | Dark value | Must clear, on which ground |
| --- | --- | --- | --- | --- |
| `bg` | #fcfaf8 | Page ground. Surfaces must read as lifted from it. | Yes | A ground, not a mark. Must sit visibly below `surface`. Text on it: `ink` 15.55:1, `muted` 5.67:1, `accent-text` 5.16:1, `focus` ring 12.52:1 (all `WarmingUp/README.md`), chosen chip `accent` border 4.65:1 (`FilterChips/README.md`). |
| `surface` | #ffffff | Every card, chip, tooltip, menu, the tray, the drawer and overlay panels, the hero field. | Yes | The ground most figures are measured on. Its step from `bg` carries elevation once shadows fade on dark. bg to surface step was never measured in light; needs measuring. |
| `surface-tint` | #fcf5f3 | Warm relief inside a card. Five jobs: the action area, row hover, a selected chip or segment, the selected file in FileTree, the active option in a Select menu (`decisions.md`, Open 9). Also the idle send button. | Yes | Must read as distinct from `surface` (never measured in light; needs measuring). Every text and mark that sits on `surface` must also clear on it. |
| `ink` | #23201e | All primary text. | Yes | 4.5:1 on every ground. Light: 16.2:1 on surface (tokens.json), 15.55:1 on bg (WarmingUp), 14.47:1 and 14.15:1 on the diff tints (DiffView). |
| `muted` | #6a635e | Labels, metadata, mono text, axis text, Timeline nodes, the neutral and unavailable marks. | Yes | 4.5:1 on `bg`, `surface` and `surface-tint` ("the floor for any text on bg or surface"). Light: 5.9:1 on surface, 5.67:1 on bg, 5.48:1 on surface-tint (ActionCard, FileTree, FilterChips). As the unavailable mark it must clear 3:1 on every card ground, because every error state uses it. |
| `line` | #23201e1a | Hairlines that draw in: row rules, chip and field borders, the Timeline and Steps spine, FileTree guides, the warming mark's ring, skeleton blocks on `bg`. | Yes. It is ink at 10% written as a literal, so it does not follow `ink`. | Low by design, not a 3:1 element. Light: 1.22:1 (Timeline spine, TextInput resting border), 1.21:1 (FileTree guides). Keep a similar quiet ratio on dark `surface`. |
| `line-soft` | #23201e0f | Card borders, card header rules, chart grid, rank and lane tracks, skeleton blocks on `surface`. | Yes. Literal ink at 6%. | Visible on `surface`. On dark the card border against `bg` does more of the work the shadow did in light. Never measured in light; needs measuring. |
| `line-strong` | #23201e38 | Hover border on fields, the hero repo field and chips. | Yes. Literal ink at 22%. | 1.57:1 in light: an affordance, not identity, so it does not need 3:1. Keep it clearly above `line`. |
| `accent` | #c4492f | The one brand hue, coral. Insight rule, Metric bars, chart series 1, endpoints, warming arc, primary button, selected chip borders, FileTree selection edge, Select check, caret. | Likely. See section 4. | 3:1 on `surface` (4.84:1), `surface-tint` (4.49:1) and `bg` (4.65:1). `accent-ink` on it 4.5:1 (4.84:1, ActionCard). Separated from `crit-fill` (section 4). |
| `accent-2` | #9e3a9a | Violet. Only the far end of the accent gradient (Metric bar, Insight rule, warming bar, primary button, send, the drawer's model latency bar). Never alone. | Likely. See section 4. | `accent-ink` on it 4.5:1 (5.96:1, ActionCard). As the end of a bar or rule it is a mark at 3:1 on its ground; no light figure was recorded as a mark. |
| `accent-ink` | #ffffff | Text on the accent or the gradient. Also the Heatmap peak dot. | Decide. See section 4. | 4.5:1 on both gradient ends (4.84:1 and 5.96:1, ActionCard; Button says 4.8:1). 3:1 against `heat-5` for the peak dot (5.67:1, Heatmap). |
| `accent-text` | #b6462f | Accent as words: links, Try again, Show all, View drafts, the first Steps numeral. Underlined at 35% of itself. | Yes | 4.5:1 on `surface` (5.38:1), `surface-tint` (4.99:1) and `bg` (5.16:1, WarmingUp). |
| `focus` | #35302c | The focus ring. | Yes | Section 4. Light: 13.04:1 on surface, 12.10:1 on surface-tint (ActionCard; Timeline says 12.1:1), 12.52:1 on bg (WarmingUp). |
| `good` | #157448 | Positive text: approved tag, additions, good delta, "better". | Yes | 4.5:1 on its own 10% tag tint over `surface-tint` (4.68:1). 5.8:1 on surface, 5.38:1 on the surface-tint capsule (FileTree). |
| `good-fill` | #1f8f5a | Positive marks: outlined dots, bars, swatches. Never text. | Yes | 3:1 on `surface` (the WarmingUp good mark: 4.09:1). |
| `warn` | #945607 | Waiting text: review pending, aging delta, "at risk". Honey, not mustard. | Yes | 4.5:1 on its own tag tint over `surface-tint` (4.73:1). 5.8:1 on surface. |
| `warn-fill` | #c97a12 | Waiting marks: dashed dots, the ContributorRank risk key. Never text. | Yes | 3:1 on `surface`. No light figure recorded; needs measuring. The dashed 1.5px stroke is thin, so measure it as drawn. |
| `crit` | #a41b3d | Blocking text: changes requested, failing, deletions, "worse", invalid input sentences. | Yes | Section 4. Light: 7.49:1 on surface, 6.96:1 on surface-tint, 5.87:1 on its own tag tint over surface-tint. |
| `crit-fill` | #b21f43 | Blocking marks: filled dots, failing bars, the hot card border, an invalid field's border. Never text. | Yes | Section 4. Light: 6.62:1 on surface; 1.37:1 against `accent`, OKLab ΔE 9.2 (protan 10.5, deutan 8.2). |
| `data-1` | `{accent}` | Chart series 1. An alias of `accent`. | Follows `accent` | Only give it its own dark value if charts need something the accent cannot give. |
| `data-2` | #3b6ea5 | Chart series 2, slate. | Yes | 3:1 on `surface` (5.30:1). Against `data-1`: ΔE 17.5 color-blind, 25.5 normal vision. |
| `data-ref` | #958c85 | A reference or previous-period series, bars outside the ContributorRank wall, the p90 rule, the Sparkline body, the drawer's latency bars, the "spread out" key. | Yes | 3:1 on `surface` (3.30:1) and `surface-tint` (3.06:1), so hovered rows keep marks above the floor. Against `data-1`: ΔE 10.9 deuteranopia, 16.8 normal (ContributorRank). Section 4. |
| `heat-0` to `heat-5` | #f3efec, #ffcec2, #f5ac9c, #e88671, #d4614a, #b44029 | Heatmap ramp. | Yes, all six | Section 4. |
| `diff-add`, `diff-del`, `diff-add-word`, `diff-del-word` | #ecf4f0, #f8edef, #dae9e2, #f0dbe0 | DiffView line and word grounds. | Yes, all four. They are literals derived from `good` and `crit` over white, so they do not follow. | Section 4. |
| `glow-a` | #f16b4e24 | Cursor warmth inner ring (coral at about 14%), and the accent bloom on flagged cards. | Yes | Decorative, no floor of its own. Text over its warmest point must still clear. Section 4. |
| `glow-b` | #c24bb614 | Cursor warmth outer ring (violet at about 8%). | Yes | As `glow-a`. |
| `scrim` | #23201e1a | The drawer and overlay backdrop: ink at 10%. | Yes. A literal. | Must dim the page, never lighten it. Section 3, drawer and overlay. |

### Shadow

All six need dark values. The build emits shadow tokens per theme alongside color. In light they are warm and coral tinted; on a dark ground a tinted low-alpha shadow mostly disappears, so elevation has to come from the `bg` to `surface` step and the `line-soft` border, with the shadow as support.

| Token | Light | Job |
| --- | --- | --- |
| `card` | 0 12px 40px #e2606212, 0 1px 3px #23201e0d | Every card at rest. Warm, low, wide. |
| `card-hover` | 0 16px 44px #e2606221, 0 1px 3px #23201e0d | A clickable card or chip on hover. |
| `card-hot` | 0 12px 40px #d4445e1a, 0 1px 3px #23201e0d | A card the model flagged as blocking. Pairs with a `crit-fill` border at 35%. Section 4. |
| `bloom` | 0 16px 48px #e2606233 | The peak of the bloom move on flagged cards and the ActionCard; animates from none to this and back. |
| `tray` | 0 10px 36px #0000001f | The fixed ask tray only. |
| `sheet` | 0 24px 64px #23201e24, 0 2px 6px #23201e14 | The floating drawer sheet and the overlay. |

### Tokens that need no change

Spacing (`space-1` to `space-8`), radius (`radius-xs` to `radius-pill`), size (strokes, marks, hit areas, widths), type families and styles, and the three density blocks. The token build emits theme blocks for color and shadow only, so none of these can differ by theme, and the two left edges cannot drift.

## 3. The grounds, and which figure is redone on which

### The grounds

Every figure in this system is measured on one of these. Each needs its own dark value or is derived from ones that do.

| Ground | What it is | Where it appears |
| --- | --- | --- |
| `bg` | The page. | Nav, the question, the eyebrow note, the strip and footer, the Insight and the WarmingUp lead (both sit on the page, not a card), FilterChips above their target, a disabled field, the landing hero field's surroundings. |
| `surface` | Every card and floating panel. | Cards, chips, tooltips, menus, the tray, the drawer and overlay panels. |
| `surface-tint` | The one tinted ground inside a card. | Row hover in every list and chart, selected chips and segments, the FileTree selection capsule, the active Select option, the idle send button. |
| Tag tint over `surface-tint` | A state text color at 10% over `surface-tint`, drawn by `color-mix(in srgb, currentColor 10%, transparent)`. | Every state tag, worst case when its row is hovered. Also the `cached` tag (`muted` on its own tint). |
| The hot card | `surface` inside a `crit-fill` border at 35% (`color-mix(in srgb, var(--crit-fill) 35%, transparent)`) with the `card-hot` shadow. | A Metric the model marks `hot`. |
| The action area | `surface-tint` as a card ground. | The whole ActionCard; the actions row of a Form. Carries the gradient primary button. |
| The accent gradient | `accent` to `accent-2` at 135deg (buttons) or along the bar. | Primary buttons, Confirm, Form submit, the hero field's button, the ready send button. Ground for `accent-ink` labels. |
| The diff rows | `diff-add`, `diff-del`, and the word highlights inside them. | DiffView lines, full bleed. |
| Heat cells | `heat-0` to `heat-5`, with 2px `surface` gaps. | Heatmap. Ground for the peak dot and the neighbors of a focused cell. |
| Drawer and overlay over the scrim | `surface` panels over the page dimmed by `scrim`. | The "how this was built" drawer, the how-it-works overlay. The panel's edge must separate from the dimmed page; nothing is read on the scrim itself. |

### Figures by component

Every contrast figure found in the sources, with its light ground and the dark ground it must be redone on. "Same" means the dark version of the light ground. Grouped by component; the system-wide figures from `tokens.json` and `design-system/decisions.md` come first.

**System (`design-system/tokens.json`, `design-system/decisions.md` System)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| `ink` text | 16.2:1 | surface | surface, bg, surface-tint, tag tint, diff rows |
| `muted` text | 5.9:1 | surface | surface, bg, surface-tint |
| `line-strong` hover border | 1.57:1 | surface (implied) | surface |
| `accent` mark | 4.8:1, 4.49:1 | surface, surface-tint | surface, surface-tint, bg |
| `accent-text` | 5.38:1, 4.99:1 | surface, surface-tint | surface, surface-tint, bg |
| `focus` ring | 13.04:1 | surface | every ground in the table above |
| `focus` ring against the crimson error border | 1.97:1 (2.85:1 before the crimson change; a coral ring was 1.06:1) | ring beside a `crit-fill` border, 2px surface gap between | same pairing on dark (section 4) |
| `good` text | 5.8:1, 4.68:1 | surface, own tag tint over surface-tint | same |
| `warn` text | 5.8:1, 4.73:1 | surface, own tag tint over surface-tint | same |
| `crit` text | 7.49:1, 6.96:1, 5.87:1 | surface, surface-tint, own tag tint over surface-tint | same |
| `crit-fill` mark | 6.62:1 | surface | surface, hot card, surface-tint |
| `crit-fill` against `accent` | 1.37:1, ΔE 9.2 (protan 10.5, deutan 8.2), target ΔE 8 | side by side | same, all three vision types |
| `data-2` | 5.30:1; ΔE 17.5 color-blind, 25.5 normal against `data-1` | surface | surface, surface-tint |
| `data-ref` | 3.30:1, 3.06:1 | surface, surface-tint | same |
| `heat-4`, `heat-5` | 3.74:1, 5.67:1 | surface | surface (section 4) |
| `ink` on diff tints | 14.47:1, 14.15:1, 12.27:1 | `diff-add`, `diff-del`, `diff-del-word` | same |
| Selected chip at a 45% accent border (withdrawn) | 1.89:1 | surface-tint | not needed; the full `accent` border replaced it (`decisions.md` Screens) |
| Resting field and chip borders | 1.22:1 by design | surface | surface (`decisions.md` Open 16) |

**ActionCard (`design-system/components/ActionCard/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Copy in `muted` | 5.48:1 | surface-tint | action area |
| `accent-ink` on the primary gradient | 4.84:1 lightest end, 5.96:1 violet end | gradient | both gradient ends |
| `focus` ring on the gradient Confirm | 12.10:1 | surface-tint (the 2px offset gap) | action area |
| Links in `accent-text` | 4.99:1 (`accent` would be 4.49:1) | surface-tint | action area |

**Button (`design-system/components/Button/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| White label on the gradient | 4.8:1 at the lightest end | gradient | both ends |

**Comparison (`design-system/components/Comparison/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| `data-ref` previous bar on hover | 3.06:1 | surface-tint | surface-tint |
| `data-1` current bar, verdict words in `good`, `crit`, `muted` | not recorded | surface, surface-tint | needs measuring on both |

**ContributorRank (`design-system/components/ContributorRank/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Wall bars `data-1` | 4.84:1, 4.49:1 | surface, surface-tint | same |
| Other bars `data-ref` | 3.30:1, 3.06:1 | surface, surface-tint | same |
| `data-1` against `data-ref` | ΔE 10.9 deuteranopia, 16.8 normal | side by side | same |
| Risk key `warn-fill`, "at risk" tag `warn` | not recorded | surface | needs measuring (the tag is covered by the `warn` token figure) |

**DiffView (`design-system/components/DiffView/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| `ink` code text | 14.47:1, 14.15:1 | `diff-add`, `diff-del` | same |
| `ink` on word highlights | 12.9:1, 12.27:1 | `diff-add-word`, `diff-del-word` | same |
| `muted` line numbers | 5.27:1, 5.16:1 | `diff-add`, `diff-del` | same, and on the word highlights (not recorded in light) |
| Header counts `good`, `crit` | 5.8:1, 7.49:1 | surface | surface |
| Zero count in `muted` | 5.9:1 | surface | surface |
| Show all, View on GitHub in `accent-text` | 5.38:1 | surface | surface |
| The tints themselves | 1.12:1 by design | against surface | surface (section 4) |

**Distribution (`design-system/components/Distribution/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Bars `data-1` | 4.84:1, 4.49:1 | surface, the surface-tint hover shape | same |
| Median rule in `ink` | 16.2:1 | surface | surface |
| p90 rule `data-ref` | 3.30:1, 3.06:1 | surface, hover shape | same |
| Axis and source text `muted` | 5.90:1 | surface | surface, hover shape |
| `focus` ring | 13.04:1 | surface | surface |
| Try again `accent-text` | 5.38:1 | surface | surface |

**FileTree (`design-system/components/FileTree/README.md`, `decisions.md` FileTree)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Folder names `muted` | 5.9:1, 5.48:1 | surface, the surface-tint capsule | same |
| Counts on the capsule `good`, `crit` | 5.38:1, 6.96:1 | surface-tint | surface-tint |
| Selected 1px `accent` edge and `accent` icon | 4.49:1 (a first 45% edge measured under 3:1) | surface-tint | surface-tint |
| Guides `line` | 1.21:1 by design | surface | surface |

**FilterChips (`design-system/components/FilterChips/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Label `muted` | 5.90:1 | surface | surface |
| Chosen `accent` border | 4.49:1, 4.65:1 | surface-tint (inside), bg (outside) | both |
| Count `muted` | 5.48:1 | surface-tint | surface-tint |
| Chosen tint alone | under 2:1 (`decisions.md` Inputs) | against surface | not a requirement; the border and check carry the state |

**Heatmap (`design-system/components/Heatmap/README.md`, `decisions.md` Heatmap)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| `heat-1`, `heat-2`, `heat-3` | 1.41:1, 1.86:1, 2.60:1, under 3:1 by design | surface | surface |
| `heat-4`, `heat-5` | 3.74:1, 5.67:1 (tokens.json) | surface | surface |
| Peak dot `accent-ink` | 5.67:1 | `heat-5` | `heat-5` |
| `focus` ring on the 5px `surface` halo | 13.04:1 | surface halo | surface halo |
| `focus` ring directly on `heat-5` (why the halo exists) | 2.30:1 | heat-5 | measure again to decide whether the halo is still needed |

**Insight (`design-system/components/Insight/README.md`)**

No figures recorded. Needs measuring on `bg`: the sentence in `ink`, the source line in `muted`, the gradient rule at both ends, the solid `muted` rule (nothing notable, error), the `line` track behind a warming rule, the `line` skeleton blocks.

**LineChart (`design-system/components/LineChart/README.md`, `decisions.md` LineChart)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| `data-1` line | 4.84:1 | surface | surface |
| `data-2` line | 5.30:1 | surface | surface |
| `crit-fill` failure columns | 6.62:1; 1.37:1 against `data-1` | surface | surface |
| `data-1` against `crit-fill`, deuteranopia | ΔE 8.2 (was 2.2 before the crimson change) | side by side | same |
| Axis and legend text `muted` | 5.90:1 | surface | surface |
| End values `ink` | 16.2:1 | surface | surface |
| Try again `accent-text` | 5.38:1 | surface | surface |
| `focus` ring | 13.04:1 | surface | surface |

Note: the LineChart README's accessibility line still says `data-1` and `crit-fill` are "only 3.6 apart in ΔE". That is the pre-crimson figure; `decisions.md` and `tokens.json` give 9.2. Measure fresh on dark.

**Metric (`design-system/components/Metric/README.md`)**

No figures recorded. Needs measuring: the label and suffix in `muted`, the number in `ink`, the delta in `muted`, `good` and `crit`, the bar at both gradient ends, the warming track in `line-soft`, all on `surface`; then the same set inside the hot card, plus the filled `crit-fill` mark and the 35% border (section 4).

**Select (`design-system/components/Select/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Chosen check `accent` | 4.49:1 | surface-tint (the active row) | surface-tint |
| Counts and placeholder `muted` | not recorded | surface, surface-tint | needs measuring (covered by the `muted` token figures) |

**Sparkline (`design-system/components/Sparkline/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Body `data-ref` | 3.30:1, 3.06:1 | surface, surface-tint | same |
| Latest segment and endpoint `accent` | 4.84:1 | surface | surface, surface-tint (a Sparkline sits in hoverable list rows) |
| Try again `accent-text` | 5.38:1 | surface | surface |

**StatusList (`design-system/components/StatusList/README.md`)**

No figures of its own; its tags are the `good`, `warn` and `crit` token figures on their own tint over `surface-tint`. Needs measuring: the four marks (`good-fill` outlined, `warn-fill` dashed, `crit-fill` filled, `muted` outlined) on `surface` and on the `surface-tint` hover.

**Steps (`design-system/components/Steps/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Title `ink` | 16.19:1 | surface | surface |
| Body, numeral and fact `muted` | 5.90:1 | surface | surface |
| First numeral and link `accent-text` | 5.38:1 | surface | surface |
| First ring `accent` | 4.84:1 | surface | surface |

**TextInput (`design-system/components/TextInput/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Placeholder `muted` | 5.90:1 | surface | surface |
| `focus` ring | 13.04:1 | surface | surface, and bg for the hero field |
| Error border `crit-fill` | 6.62:1 | surface | surface |
| Error sentence `crit` | 7.49:1 | surface | surface |
| Try again `accent-text` (unreachable) | 5.38:1 | surface | surface |
| Disabled label, value and chevron `muted` | 5.67:1 | bg | bg |
| Resting border `line` | 1.22:1 by design; `muted` 5.90:1 under `prefers-contrast: more` | surface | surface |

**Timeline (`design-system/components/Timeline/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Node `muted` | 5.90:1 | surface | surface, surface-tint |
| Newest node `accent` | 4.84:1, 4.49:1 | surface, hover tint | same |
| Every text color | 4.5:1 or more | surface, surface-tint | same |
| Try again `accent-text` | 5.38:1, 4.99:1 | surface, surface-tint | same |
| `focus` ring | 13.04:1, 12.1:1 | surface, surface-tint | same |
| Spine `line` | 1.22:1 by design | surface | surface |

**WarmingUp (`design-system/components/WarmingUp/README.md`)**

| Figure | Light | Light ground | Redo on |
| --- | --- | --- | --- |
| Try again `accent-text` | 5.38:1, 5.16:1 | surface, bg | same |
| `focus` ring | 12.52:1 | bg | bg |
| Lead `ink`, `muted` | 15.55:1, 5.67:1 | bg | bg |
| Cached tag (`muted` on its own tint) | 5.14:1 | own tint over surface | same |
| Ready tag (`good`) | 5.03:1 | own tint over surface | same |
| Elapsed line `accent` | 4.84:1 | surface | surface |
| Good mark `good-fill` | 4.09:1 | surface | surface |

**Ask, Form, Cover**

`Ask/README.md` and `Form/README.md` record no figures; Form inherits TextInput, Select and FilterChips, and its actions row is the action area. Cover has no README, only `preview.html`. Needs measuring: question chips in `muted` on `surface` and selected on `surface-tint`; the Form actions row as the action area.

**Shell (`design-system/screens/shell.css`)**

The shell records one figure: the withdrawn 45% selected-chip border at 1.89:1 on `surface-tint`. Nothing else is measured. Needs measuring: nav links in `muted` and the current one in `ink` on `bg`; eyebrow chips (`muted` mono on `surface`, `line` border) and the repo chip in `ink`; the question and built figure in `ink` on `bg`; the strip and footer in `muted` on `bg`; question chips at rest and selected; the tray (a `surface` pill with the `tray` shadow floating over page content); the idle send (`muted` on `surface-tint`) and the ready send (`accent-ink` on the gradient); the density segments; in the drawer and overlay, `ink` and `muted` on `surface`, the latency tracks (`line-soft`) with `data-ref` and gradient bars, and the panel edge against the dimmed page.

## 4. Special cases

### The hot card

A Metric the model marks `hot` (blocking) gets three things at once: a `crit-fill` border mixed to 35% over transparent, the `card-hot` shadow (0 12px 40px #d4445e1a, 0 1px 3px #23201e0d), and a filled `crit-fill` mark in the top right corner with a hidden "Blocking." for screen readers. At most two per screen. The 35% border alone was judged to carry state by color, which is why the mark exists (`decisions.md` Metric).

On dark:

- The 35% border sits over `surface`. Its contrast against `surface` was never measured in light; it needs measuring in both themes. It must read as clearly different from an ordinary card's `line-soft` border, from a selected chip's full `accent` border, and from the `focus` ring.
- The `card-hot` shadow is a crimson tint at 10%; on a dark ground it will barely show. Decide whether dark keeps a tinted glow or lets the border and mark carry the state. Either way, the mark must clear 3:1 on `surface`, and every Metric figure listed in section 3 must hold inside the hot card.
- If `crit-fill` changes for dark, the 35% mix changes with it, because the mix is computed from the token at runtime.

### The heat ramp, `heat-0` to `heat-5`

Light values: `heat-0` #f3efec (zero), then #ffcec2, #f5ac9c, #e88671, #d4614a, #b44029, one coral hue light to dark. A count maps to step ceil(5 × count ÷ peak); the peak is always `heat-5`. Cells sit on 2px `surface` gaps. Light figures on surface: `heat-1` 1.41:1, `heat-2` 1.86:1, `heat-3` 2.60:1, `heat-4` 3.74:1, `heat-5` 5.67:1. The light steps sit under 3:1 by design; the tooltip, the legend with its zero swatch and an always-available table view carry the values (`Heatmap/README.md`).

The dark ramp must be:

- **Ordered.** Contrast against `surface` rises step by step from `heat-1` to `heat-5`, so the peak is the step furthest from the ground. On a dark ground that usually means the ramp runs dark to bright, the reverse of light. Keep one coral hue.
- **Distinguishable.** Each step must be told from its neighbors. Give the contrast ratio and ΔE between every adjacent pair, plus each step against `surface`.
- **A real zero.** `heat-0` must differ from `surface` (or the grid disappears into its gaps) and from `heat-1` by hue as well as lightness, as in light. The heat-0 to heat-1 separation was not recorded in light; needs measuring.
- **Clear of the accent and crit.** The ramp is coral like the accent; its peak must not read as a `crit-fill` mark.
- **The peak dot.** A 4px dot in `accent-ink` centered in the peak cell, 5.67:1 on `heat-5` in light, the one mark in the component that bounces. If `heat-5` becomes the brightest step, a white dot on it will likely fail 3:1. A dark dot would need a value other than `accent-ink`, which would also change every button label. Tell us which way you go; if the dot needs its own token, name it and its job, and the build adds it (that is a one-line component change, the only one this theme might need).
- **Focus.** The ring draws on a 5px `surface` halo because `focus` on `heat-5` was 2.30:1. Measure `focus` on the dark `heat-5` and on the halo; keep the halo unless both clear easily.

### The diff tints

`diff-add` is `good` at 8% over surface, `diff-del` is `crit` at 8%, and the word highlights are 16% (`diff-del-word` per tokens.json; `diff-add-word` is the matching green). They run full bleed behind numbers and code. Text on them stays `ink`; a `+` or `−` sign column, and the words "added" and "removed" for screen readers, carry direction, so the tints themselves sit at 1.12:1 against surface by design.

On dark:

- They are literals, so re-derive all four over the dark `surface` (or choose them directly).
- `ink` must clear 4.5:1 on all four (light: 14.47:1, 14.15:1, 12.9:1, 12.27:1). `muted` line numbers must clear 4.5:1 on the line tints (light: 5.27:1, 5.16:1) and should be measured on the word highlights too.
- Low-alpha green and crimson over a dark ground tend to go muddy or vanish. The tints may stay quiet (no 3:1 requirement), but add and delete must still be told apart from each other and from `surface` at a glance, and each word highlight from its line tint.

### The focus ring on dark grounds

`focus` is #35302c, warm near-ink, 2px wide at 2px offset, drawn as an outline. Its rule is fixed: the `focus` token, never accent, never a glow. In dark it becomes a light warm color by necessity; it should read as "near paper" the way the light one reads as near ink.

It must clear 3:1 on every ground it can land on: `bg`, `surface`, `surface-tint`, the action area (the gap beside the gradient Confirm), the hot card, the drawer and overlay panels, the heat halo. Two placements need a look:

- **Against an error border.** An invalid field shows the `crit-fill` border inside and the ring outside, with a 2px `surface` gap between. In light the ring is 1.97:1 against the crimson border and a different hue. On dark they must still separate by hue and lightness.
- **The tray field.** The ask field in the tray draws its ring inset (offset −2px) inside its pill, on `surface`.

### Crit on dark, and error is never crit

`crit` (text) and `crit-fill` (marks) are crimson, set a 10.6° hue step cooler than the old red so a failing mark never reads as the coral accent. `crit-fill` sits 19.7° in OKLCH hue from the accent, at 1.37:1 against it, ΔE 9.2 (protan 10.5, deutan 8.2), past the ΔE 8 target (`decisions.md` System).

On dark:

- **The text and fill relationship inverts.** In light the text token is a shade deeper than the fill. On dark, text must be lighter than the fill to reach 4.5:1. Every state pair (`good`, `warn`, `crit`) flips the same way.
- **`crit` text** clears 4.5:1 on `surface`, `surface-tint` and its own 10% tag tint over `surface-tint` (light: 7.49:1, 6.96:1, 5.87:1), and on the FileTree capsule (6.96:1 in light).
- **`crit-fill` marks** clear 3:1 on `surface`, `surface-tint` and inside the hot card (light: 6.62:1 on surface). It also draws failing bars in LineChart beside `data-1`.
- **Separation from the accent holds.** Measure `crit-fill` against `accent` and against `data-1` for contrast and ΔE under normal vision, protanopia and deuteranopia; keep ΔE at 8 or more in all three. Crimson lightened for dark drifts toward pink or toward coral; keep it reading crimson.
- **Error is never crit.** A failed request uses the unavailable mark (outlined `muted` with a slash) and `muted` text, with the cause in `meta` and Try again in `accent-text`. On dark that mark must clear 3:1 on every card ground, and must not read as a neutral empty state at a glance any more than it does in light.

### Also likely to break

- **The accent gradient and its white label.** Buttons are `accent` to `accent-2` with `accent-ink` (#ffffff) text: 4.84:1 at the coral end, 5.96:1 at the violet end. The same `accent` must also clear 3:1 as a mark on the dark grounds. Derived from the light values with the WCAG formula, not measured: for white text at 4.5:1 the accent's relative luminance can be at most about 0.183 (it is 0.167 now), and for that accent to reach 3:1 on a dark ground, the ground's luminance can be at most about 0.022 (roughly #292929 as a neutral). The current violet (luminance 0.126) would need a ground of about 0.009 or darker (roughly #171717) to reach 3:1 as a mark. So either the dark grounds are very dark, or `accent-2` (and possibly `accent`) lightens and you check the label still clears 4.5:1, or `accent-ink` changes. Measure whichever you choose. The same gradient draws the Metric bar, the Insight rule, the 3px warming bar, the drawer's model latency bar and the ready send button.
- **`accent-text` lightens.** On dark, words in the accent must be lighter than the accent mark, the reverse of light. Its 35% underline is mixed from it at runtime.
- **`data-ref` and `data-2` on charts.** `data-ref` warm gray is meant to be the quiet series. On dark, a gray light enough for 3:1 can end up louder than a coral `data-1`; keep `data-1` the series the eye lands on. `data-2` slate (luminance 0.148) needs a ground darker than about 0.016 to keep 3:1, so it likely needs a dark value; keep its ΔE against `data-1` (light: 17.5 color-blind, 25.5 normal).
- **Cursor warmth.** A fixed radial gradient follows the pointer over `bg`: `glow-a` inner, `glow-b` at 45%, transparent by 72%, 560px across. It is the one thing on the page not caused by the data, and it is off under reduced motion. Low-alpha coral on a dark page can read as a stain rather than warmth. No floor of its own, but `muted` and `ink` text over its warmest point must still clear 4.5:1; never measured in light, needs measuring in both. `glow-a` also tints the bloom on flagged cards.
- **`warn` and `good` on dark.** Lightened `warn` drifts toward mustard; the system chose honey on purpose. Lightened `good` can drift toward mint. Both texts clear 4.5:1 on their own tag tint over `surface-tint` (light: 4.68:1 and 4.73:1); both fills clear 3:1 on `surface` (`good-fill` 4.09:1 in light; `warn-fill` not recorded). The `warn-fill` mark is a dashed 1.5px outline, so measure it as drawn.
- **The hairline family.** `line`, `line-soft`, `line-strong` and `scrim` are ink with alpha written as literals; they will stay dark ink unless given dark values, and dark ink on a dark ground is invisible.
- **Skeletons.** Loading blocks are `line-soft` on `surface` and `line` on `bg`. They must read as placeholders, quieter than any real text.
- **Rings that part lines.** Endpoints, Timeline nodes, the Distribution cap and Heatmap hover use a 2px `surface` ring (or the hover ground) to cut the line beneath. They follow `surface` automatically; check them on the dark hover tint.
- **The scrim.** Ink at 10% dims a light page. On dark it must dim further, so it is likely near-black at a higher alpha. Note that the reference `shell.css` mixes the scrim from `ink` directly; production uses the `scrim` token.
- **Native controls.** The dark block sets `color-scheme: dark`, so scrollbars, the native picker a Select opens on touch devices, and form autofill follow the browser's dark styling. Check them in the screenshots.

## 5. How the theme is switched and delivered

You only need this much of the code:

- **Values go in `design-system/tokens.json`.** Add `{ "id": "dark", "name": "Dark" }` to `color.themes`. For each color and shadow token that changes, the `value` becomes an object keyed by theme: `"value": { "light": "#fcfaf8", "dark": "#..." }`. A token you leave as a plain string keeps its light value in dark. An alias such as `data-1`'s `"{accent}"` works in either.
- **`tokens.css` regenerates.** `pnpm tokens:build` emits the light values on `:root`, a `[data-theme="dark"]` block, and a `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` block. Both dark blocks set `color-scheme: dark`.
- **Switching.** By default the page follows the operating system through `prefers-color-scheme`. An explicit `data-theme="light"` or `data-theme="dark"` on the root overrides it either way. Inside Claude, the MCP App frame follows the host's theme (plan task 9.0). Whether the website shows a visible theme toggle is not decided in `docs/`; say if you want one.
- **No component changes.** Components read only tokens, so new token values restyle the whole catalog. The only exception would be a new token you ask for, such as a Heatmap peak dot color; name it and its job, and it is added to the token file and wired in by the build.
- **The reference screens carry their own copy.** The HTML references in `design-system/screens/` load `genui.css`, whose `:root` repeats the light tokens as raw hex (no `scrim` or `sheet`). To render a reference screen in dark, override that `:root` block with your dark values.

## 6. What to hand back

1. **The dark set in `tokens.json` form.** A dark value for every color token marked "Yes" or "Likely" in section 2 and for all six shadows, as `{ "light", "dark" }` pairs. For `accent`, `accent-2`, `accent-ink` and `data-1`, say whether each keeps its light value.
2. **The measurement table.** For each dark value, its contrast on every ground listed against it in sections 2 and 3, with the floor it must clear (4.5:1 text, 3:1 marks and indicators, or "low by design" for hairlines and diff tints). Fill in the figures marked "needs measuring" too, and add each dark figure beside the light one in the token's usage note.
3. **The color-vision checks.** OKLab ΔE under normal vision, protanopia and deuteranopia for `crit-fill` against `accent`, `crit-fill` against `data-1`, `data-1` against `data-2`, and `data-1` against `data-ref`.
4. **The heat ramp.** Six values with each step's contrast against `surface`, the contrast and ΔE between each adjacent pair, `heat-0` against `surface` and `heat-1`, the peak dot against `heat-5`, and `focus` on `heat-5` and on the halo. Say which way the ramp runs and what the peak dot becomes.
5. **Decisions in one line each.** How the hot card reads without much shadow; whether `accent-ink` stays white; the cursor warmth values; any new token, with its name and job; a theme toggle or not.
6. **Screenshots in dark** of the reference screens in `design-system/screens/`, at 1440 and 390 wide: Landing, Main, Drawer, HowItWorks, Warming, RateLimit, DailyCap, NearEmpty, Catalog, Evals, About, Carrying, CISlower and NewContributor, plus MCPApp in its 420px frame. Main (a hot Metric, tags, a list), Carrying (ContributorRank, Heatmap), CISlower (LineChart with the failure strip, Sparklines) and the Drawer cover most special cases between them.

The build takes it from there: `pnpm tokens:build`, every component checked on `/catalog` in dark, and `pnpm a11y` in dark must report zero contrast failures.
