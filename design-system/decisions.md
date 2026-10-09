# Decision log

This log records what the Generative UI design system decided and why, from the direction study through the Oct 8 2026 build-out. The full audit (Oct 8) came back clean with two system changes, both logged below: `crit` moved to crimson, and sample data is anonymized for the catalog. Everything under Open for the audit is settled in the development plan. Treat Unverified as unconfirmed until checked.

## System

- **Visual direction is "Blend".** Light, rounded and warm, with left-to-right draw-in, so every piece arrives by a visible cause.
- **The model chooses meaning, never values.** It sets `tone`, `emphasis` and `density`; the system writes every state word (tags, verdicts, validation, restatements), so one state always reads one way.
- **Two tokens per state color; text is measured on its darkest ground,** its own 10% tag tint over `surface-tint`. Tags failed 4.5:1 there, so `good` moved #1e7a4e to #157448 and `warn` #9c650f to #945607, nudged toward orange so it reads honey, not mustard.
- **`crit` is crimson, so it never reads as the accent.** The audit measured `crit-fill` #d14343 against `accent` #c4492f at 1.06:1: a coral chart bar and a failing mark differed by lightness only, and barely (OKLab ΔE 3.6, deutan 2.2). `crit` went #b83232 to #a41b3d and `crit-fill` #d14343 to #b21f43, a 10.6° hue step cooler (OKLCH hue 24.5 to 13.9, now 19.7° from the accent) and slightly deeper. `crit-fill` against `accent` is now 1.37:1, ΔE 9.2 (protan 10.5, deutan 8.2, past the 8 target), so the two separate by hue for every reader and by lightness for color-blind readers. Re-verified: `crit` 5.93 to 7.49:1 on surface, 5.51 to 6.96:1 on `surface-tint`, 4.76 to 5.87:1 on its own tag tint over `surface-tint`; `crit-fill` 4.57 to 6.62:1 on surface. Derived values regenerated: `diff-del` #f9efef to #f8edef, `diff-del-word` #f4dede to #f0dbe0, the `card-hot` shadow tint #d64545 to #d4445e. `good` and `warn` unchanged.
- **`accent-text` #b6462f for accent as words.** Plain accent is 4.49:1 on `surface-tint`. Marks, bars, rings and the primary gradient stay `accent`.
- **Focus is `focus` #35302c, 2px at 2px offset, never accent.** A coral ring was 1.06:1 against a `crit-fill` error border. Against the crimson border the ring is 1.97:1 (2.85:1 before the crimson change), a different hue, with a 2px surface gap between them; the ring is 13.04:1 on surface.
- **One side padding per density for cards and rows** (`space-4`, `space-5`, `space-6`). Spacious rows had been `space-5` inside `space-6` cards, breaking the shared content edge.
- **One row hover:** `surface-tint`, `radius-md`, inset `space-2`, neighboring hairlines hidden, no shadow. Per-component hover colors were withdrawn.
- **Five shared states and the frame always renders.** Error is never crit; warming (GitHub 202) fills the 3px bar or Insight rule. A zero is data, impossible states are omitted with a reason, skeletons preview real geometry, charts keep full height.
- **Data color.** `data-1` is the accent, `data-2` slate #3b6ea5 (CVD validated), `data-ref` #958c85 (3.06:1 on tint, so hovered marks hold 3:1). Two series at most, one y axis, text never in a series color. `heat-1` retuned to #ffcec2 for separation from zero. Axis type rose from 9px to 10.5px.
- **Shared additions:** `g-tag quiet` for neutral tags, `g-link` for text actions, four diff tints, zero counts in `muted` because a red zero reads as a deletion.
- **Motion grammar.** Exits reverse entrances and run just ahead of them; survivors morph in place. Framer owns the wrapper, GSAP the guts. Only one latest or peak point per component bounces; WarmingUp's lanes are the one linear motion, because they are a clock.
- **One light theme for now,** so every contrast figure here holds on light grounds only. A dark theme is queued for v1 (the MCP App phase) as a second theme in tokens.json, with every figure redone on dark grounds.
- **Where a component note disagrees with the README or REVISIONS.md, those win.** Resolved since the notes: the axis size and heat ramp are in tokens.json, Metric has Sparkline's `trend` prop, `data-ref-hover` is withdrawn, the neutral tag shipped, lane motion is in motion.md. The rest is in Open.
- **Settled in the final cross-check:** Try again reads `accent-text` in every README, the leftover StatusRow folder is gone, `line-strong` (ink 22%) is a token, every 45% accent edge became full `accent`, and LineChart's width classes now match the shell (1280, 632, 416px).

## Components

### Metric
- **3px gradient bar, square at the card edge, round cap at the content edge,** so it reads as extended, not as a border.
- **Hot adds a filled crit mark and a hidden "Blocking."** A 35% red border alone carries state by color. At most two per screen.
- **Tabular figures kept,** because proportional digits jitter while counting. Mono `suffix` style added.

### StatusList
- **Renamed from StatusRow: the composer picks lists, never rows.** Empty and skeleton exist only at list level.
- **Item `state` is a fixed enum and the system writes the tag.**
- **`emptyTone` is good or neutral:** no failing checks is good news, no releases is not.

### Insight
- **3px rule spans the sentence and its source line.** A sentence-only rule looked like a stray tick on one-line insights.
- **Text edge is side padding plus 1px** (17, 21, 29px), where card content starts below.
- **`text-wrap: pretty`, 120 character cap;** the source line is mandatory and "nothing notable" is a real sentence.

### Timeline
- **The node is a 6px muted point, not a state mark;** an 8px ring read as the neutral mark.
- **The newest node takes the 8px accent endpoint, chosen by the system,** not the model.
- **A 1px spine replaces row hairlines,** placed from per-density constants, since rows are fixed at two lines.

### LineChart
- **Failure counts get their own strip under the plot.** No second axis. Before the crimson change `data-1` against `crit-fill` failed CVD (ΔE 2.2 deutan); it now passes at 8.2, and the strip keeps them apart by position as well.
- **Zero-based y, four intervals, no area fill.**
- **X labels thin by room, counting back from the latest week;** message states draw no axis because an empty baseline reads as zeros.

### Sparkline
- **A part, never offered alone,** no taller than the Metric's digits.
- **Scale is min to max with a floor of 25% of the latest value,** so steady series don't zigzag.
- **6px endpoint, no hover, trend-level states only;** a host in a message state speaks for it.

### Distribution
- **The median is a stem behind the bars at its bin's center.** In front, it split a bar into two.
- **One color on both sides of the marker;** the slow tail is what newcomers need to see.
- **p90 at wide only, quieter on every channel;** narrow moves it to the source line.
- **Plot height is the shared `--plot-h`** (160, 200, 240px), so Distribution sits level beside LineChart.

### Comparison
- **Paired bars from zero, one scale per row,** because units differ per measure.
- **Current on top, previous beneath,** so a scan of line 1 answers the question.
- **Sign plus a system-written verdict word, no arrow; worse is crit.** Percent for durations and counts, points for rates.

### ContributorRank
- **Bars scale to the top share on a full-width track;** 0 to 100 left half the card empty.
- **The wall is color, position and the "Bus factor N" band.**
- **Risk is warn, never crit;** a concentrated repo is not blocked. A "spread out" state covers repos with no wall.

### Heatmap
- **The peak is a 4px white dot keyed in the footer,** the one bounce.
- **Linear ceil binning,** so sparse events sit two steps from empty; quantiles would invent a pattern.
- **Skeleton is row bars and message states drop the grid,** because blank cells read as zeros. Focus rides a 5px halo (`focus` on `heat-5` is 2.30:1).

### ActionCard
- **Sample mode is one word, "sample", leading the confirm line.** A banner spoils the demo.
- **The system writes the restatement from a typed `effect`;** the enum has no merge, close or delete.
- **Working state added; focus moves to Confirm** behind a 400ms activation guard.

### TextInput · Select · FilterChips · Form
- **Fields share button heights** (36, 40, 44px), so they align and spacious meets 44px touch.
- **Focus is ring only, outside a border that never changes.**
- **Invalid input is crit; unreachable is the shared error, never red.** The validator writes the words.
- **Typed identifiers in mono, offered options in sans;** a chosen chip carries a full `accent` border and a check, since its tint alone is under 2:1.
- **The hero field is 16px at every width; other fields and Select go to 16px under 480px,** so iOS never zooms.

### Steps
- **21px rings on a 1px spine, not large numerals,** which would read as Metric counts.
- **Accent on step 1 only:** where to begin, not a wizard's current step. No done states.
- **`href` links carry an arrow; `ask` links recompose without one.**

### WarmingUp
- **Time lanes, not progress bars.** A 202 gives no progress; lanes grow in real time with a gap at every check.
- **The bottom bar counts landed statistics, not time.**
- **The lead sits in the Insight's slot** and hands off by wipe.

### DiffView
- **Line tints are `good` and `crit` at 8%; text and sign stay ink.**
- **Word highlights only on equal-length paired blocks** with under half a line changed.
- **No syntax color, ligatures off, 12px code at every density, soft wrap, never horizontal scroll.**

### FileTree
- **Middle truncation by whole tokens,** keeping the top-level area and the extension.
- **Counts appear only where files are hidden;** folder chains compress.
- **Selection adds a 1px `accent` edge (4.49:1),** the one thing separating it from hover. The first 45% edge measured under 3:1.

## Screens

- **Two left edges, one rule.** Chrome (wordmark, card borders, the Insight rule, the strip rule) sits on the container edge; everything read sits on the content edge, side padding plus 1px. Question, insight and every card's first letter share one line at every density.
- **The chrome shows only what exists.** The built block is a receipt, so Warming and RateLimit, where nothing was composed, have no built block, follow-up chips or strip.
- **A system sentence takes the Insight slot** in Warming, RateLimit and the near-empty repo. RateLimit uses the unavailable mark, never crit, and its fill is honest because GitHub's reset is a known time, unlike a 202.
- **When the app can't take a question, the tray says when** ("New questions open at 17:58 UTC") as a real disabled field.
- **The landing page is the sentence:** what you do in `muted`, what it does in `ink`, then the field, twelve questions grouped by what they reveal, and a live scaled preview of a composed answer. No tray, since the hero field is the ask.
- **Selected chips and segments use a full `accent` border.** The study's 45% border measured 1.89:1 on `surface-tint`.
- **The drawer is a floating sheet** with Route, Latency (compose in the accent gradient as the model's step), GitHub reads, What the model chose, and View the JSON pinned at the foot.
- **Stress screens keep one content edge** at 1440 under every mix tried (109, 101, 97px) with regions exactly 40, 28 and 16px apart. Layout gaps found there are items 41 to 46 below.

## Open for the audit

Items 1 to 40 come from the component sheets, 41 to 57 from the screens. Audit, Oct 8: every item is settled in the development plan, and none of them changes the system. The list stays as the record of what was weighed.

1. **Small radii.** Bar ends 4px, Heatmap keys 3px, LineChart key 2px, while tokens.json gives legend swatches `radius-sm` (6px). Options: one `radius-xs` · add `radius-mark` too · raw. Default: raw.
2. **Proposed type styles** `handle` (mono 13px 500), `value` (sans 13.5px 600), `hint` (sans 12.5px) and, from the catalog, `section` (19px 600). Options: add · map to existing styles. Default: local.
3. **Type overrides.** Comparison's delta at 700 (700 is reserved for questions and metric numbers), Timeline's heading at 500, Steps' 21px title line. Options: promote · conform. Default: overrides stand.
4. **Density control heights.** Fields and ActionCard buttons scale 36/40/44px; Button and `g-btn` stay about 35.6px. Options: `control-h` and `chip-h` in genui.css · fixed Button. Default: fixed.
5. **Text action hit area.** ActionCard pads Try again to 36px; elsewhere it is text height. Options: move into `g-retry` and `g-link` · keep local. Default: local.
6. **Plus Jakarta word spacing** reads tight at 12.5px. Options: `word-spacing: .06em` on small sans · local code margins. Default: none.
7. **Named marks.** Timeline's `node` and `endpoint` are missing from the README marks list. Options: add · keep local. Default: local.
8. **Shared spine.** Timeline and Steps draw the same spine with local variables. Options: shared `--step` · separate. Default: separate.
9. **`surface-tint` has five jobs** (action area, selected chip, row hover, tree selection, menu option); the README names two. Options: accept · separate hover ground. Default: shared.
10. **Hover motion.** Steps' arrow nudges, Heatmap cells scale, buttons lift, rows don't. Options: write a rule · color only. Default: per component.
11. **Interaction-speed motion** (message wipe 350ms, menu 180ms, fold 350ms, chip choose 150 to 200ms) is outside motion.md. Options: add a tier · leave in READMEs. Default: READMEs.
12. **Small mismatches.** Chips stagger 70ms in motion.md, 60ms in Ask and FilterChips; Timeline puts Try again on the title baseline where StatusList centers it; LineChart sheets draw the half card at 644px where the shell's half is 632px. Options: align · document. Default: mismatched.
13. **Warming mark scope.** ActionCard reuses it for a write in progress. Options: define it as "waiting on GitHub" · separate mark. Default: reused; the README says 202 only.
14. **`cachedAt`.** WarmingUp's stopped state needs pieces to cite a cached copy's date; no schema has it. Options: add to stats-reading schemas · drop the fallback. Default: missing.
15. **Table view control.** Every chart promises one and Heatmap's sub-3:1 steps rely on it; none is designed. Options: card header control · build drawer · hidden tables. Default: hidden tables.
16. **Resting field and chip borders at 1.22:1,** under WCAG 1.4.11 if a border identifies the control. Options: accept · `muted` always · `muted` under `prefers-contrast: more`. Default: the last.
17. **Faint `line` structure** (crosshair, spines, tree guides, settled lanes). Options: keep · raise some to `muted` or `data-ref`. Default: keep.
18. **Model-written numbers** in Insight and LineChart's `finding`. Options: renderer checks them against the series, else a system sentence · trust. Default: unspecified.
19. **Metric plus Sparkline** shows two accent elements, and widths vary up to 18px across a row. The CI slower screen now shows four in a row. Options: accept · non-accent segment and one width per row. Default: accept.
20. **Timeline warming** fires only from `/stats/code_frequency`. Options: drop it · keep for parity. Default: kept.
21. **Timeline day heading.** Options: 500 · 400 with more space above. Default: 500.
22. **Time zone** for Timeline days and Heatmap hours. Options: viewer's · UTC. Default: viewer's.
23. **LineChart y scale.** Zero-based flattens a 13.2 to 18.4 min climb. Options: zero-based · cropped with a break. Default: zero-based.
24. **Distribution median.** Options: bin center · interpolated. Default: bin center.
25. **Distribution perspective.** Options: `reader` ("You would wait here") · `neutral` for questions about the repo. Default: `reader`.
26. **Chart gutters** break at three-digit ticks in Distribution and percent axes in LineChart (the Evals page widened it to 28px). Options: widest tick plus `space-2` · fixed `space-5`. Default: fixed.
27. **Comparison tally and per-pair error.** Options: tally on or optional; card-level error or a failed row. Default: tally on, card level.
28. **ContributorRank row 1 always fills its track** (reads as 100%). Options: top share · ceiling at the next 10% · 0 to 100. Default: top share.
29. **ContributorRank wording.** Options: "at risk" · "concentrated" · "single maintainer"; rest handles ink or `muted`. Default: "at risk", ink.
30. **Heatmap peak and grid.** Options: white dot · 1px `ink` inner ring; fluid cells (gaps can render 2 or 3px) · rounded grid. Default: dot, fluid.
31. **ActionCard height.** Options: shrinking result row · one height. Default: shrinking.
32. **ActionCard wording.** Options: "Confirm" · a verb; live question under "sample" · "Draft 3 comments"; identifiers 500 · 400. Default: Confirm, live, 500.
33. **Two input error kinds,** flagged as the decision most worth review. Options: as designed · all field errors neutral. Default: as designed.
34. **Input exceptions.** Hero field `radius-lg`, Select option `radius-sm`, menu `card` shadow. Options: keep · conform. Default: keep.
35. **Steps title style.** Options: `action` · `row-title`. Default: `action`.
36. **WarmingUp copy and schedule.** "Only happens once per repo" needs an app-side copy; checks run 0 to 120s. Options: keep a copy · "usually only on a first visit"; tune on real repos. Default: as written.
37. **DiffView `lead` prop.** Options: ship · hold for eval evidence. Default: hold.
38. **Thresholds.** DiffView folds at 40 lines and stops at 1,000; FileTree opens all at 20 files or fewer. Options: tune on eval PRs. Default: first guesses.
39. **Word highlights as `<mark>`.** Options: `<mark>` · plain span. Default: `<mark>`.
40. **FileTree's 3,000-file cap** is described, not drawn; its phone layout is drawn only as the shell's stacked split in CI slower. Options: draw now · at build. Default: described only.
41. **Layout past two cards.** Every stress screen composed five or six cards and hit three height mismatches (681 against 306, 430 against 248, 228 against 412); a full-width list reads sparse at 1280. Options: a height class per component (fixed, grows with rows), pair like with like, let a chart with a full-width form lead, add `.sc-stack` for a third card in the shorter cell, cap list width · keep one split. Default: page CSS per screen.
42. **StatusList `kind`.** Two of three stress questions needed lists of workflows and good first issues; the state enum is pull requests only. Options: `kind` (pull, issue, workflow) with per-kind states and a `value` slot · separate components. Default: those lists are not composable.
43. **Narrow rules live in page CSS.** Comparison (name on its own line), Heatmap (scrolling field, sticky day labels), Distribution's narrow form, Steps' fact under the title, the Sparkline row trend and long `g-head` titles. StatusList has two candidates: Main's three-column rule truncates meta; the MCP App's wrap rule never does. Options: adopt into each component, the wrap rule for StatusList · leave per screen. Default: per screen.
44. **Spacious on phones.** Under 640px its 29px edge wraps every card header and pushes the Insight to four lines. Options: step down one density under 640 · keep. Default: keep.
45. **Windows and sources disagree.** ContributorRank is fixed at 90 days, Heatmap offers 4, 12 or 52 weeks, Comparison has no label for `30d`, and the punch card is repo wide, so it can't answer a per-person question (Carrying's heatmap was retitled "When commits land"). Options: a `90d` Heatmap window and an `authors` filter · retitle only. Default: retitled.
46. **Composer repetition rules.** A metric repeated ContributorRank's band word for word; a Steps `ask` would recompose a list already on screen. Options: write both rules · trust the model. Default: unwritten.
47. **DiffView on phones.** The component soft wraps (YAML breaks mid token at 390); SCREENS-BRIEF says scroll. Options: wrap · scroll for indentation-significant files · scroll always. Default: wrap.
48. **Identifiers in card titles.** `g-head` has no mono span, so "Files in #83942" sets the PR number in sans. Options: allow `code` · keep identifiers out of titles. Default: sans.
49. **Shell and token proposals still in page CSS:** `scrim` token (ink 10%), `sheet` shadow, `.sc-ask.is-off` for the disabled tray, a shared `g-lead` that WarmingUp and RateLimit both use, a mono repo chip, the segmented container `sc-segs`. Options: promote · leave. Default: page CSS.
50. **Schema gaps from screens.** Timeline needs commits (an `id` that is a PR number or short SHA, plus `verb`); a Metric holding a clock time should wipe in, not count; a countdown wants `format: "clock"`; escalation reasons ("off-template · change point found") have no defined wording. Default: page level.
51. **Rate limit and daily cap behavior.** Try again before the reset re-checks for free and usually changes nothing; the tray could queue the question instead of disabling; DailyCap's built figure shows the original 1.8 s rather than the cache open. Default: Try again enabled, tray disabled, original figure.
52. **Landing.** A preselected sample repo (accent marks the selection) · no selection; "Who should review this PR?" has no PR in context; the preview's `tan(atan2())` scale has no `@supports` fallback; the page behind the overlay needs `inert`; phone placeholders are close (the hero has 9px spare, Main's tray ellipsizes). Default: as drawn.
53. **MCP App frame.** "The composer writes for the frame" is a proposal; the shell's phone rules would fire inside a 420px iframe, so the entry must skip them or use container widths. Design width 420, floor 360. Default: proposal.
54. **Catalog and Evals.** A disabled segment for states a component skips is proposed, not drawn; View JSON in renderer states shows the default sample; pass words in `muted`; the sticky index needs its own scroll under about 950px of viewport; the Evals scroll box is an idle tab stop on desktop. Default: as drawn.
55. **Built figure.** Tabular figures open a gap in `1.8`. Options: proportional once the count lands · keep. Default: keep.
56. **Ask key hints** (number keys at half opacity) are under 4.5:1 and can't map twelve questions; the landing dropped them, the Ask preview keeps them. Options: drop · keep at full `muted`. Default: mixed.
57. **Not yet stress tested:** arrival order and shared states on a composed screen, such as Carrying with one `/stats` card warming. Default: not drawn.

## Unverified

- **GitHub returns 202 only from `/stats` endpoints;** PR lists, GraphQL, PR files and git trees answer or fail. DiffView, FileTree and ActionCard skip warming on this.
- **Stats are cached per default-branch SHA,** so a push resets them.
- **`/stats/code_frequency` returns 422 at 10,000 or more commits.**
- **`/stats/punch_card` is not windowed,** so "last 12 weeks" may be wrong.
- **`/stats/contributors` covers the top 100 authors;** reviews need GraphQL and never warm.
- **Punch card is Sunday first; PR file lists cap at 3,000.**
- **Browsers:** container query units in the MCP App frame and the landing preview's `tan(atan2())` scale (Chrome 111, Safari 16, Firefox 110), `text-wrap: pretty` outside Chromium, mono rounding seen only in Chromium on Linux, `<mark>` announcements, iOS input zoom.
- **Product decisions, resolved in the build kit:** the name (Generative UI for GitHub Repos), the app-side stats copy (`cachedAt` on every shape), ActionCard live writes (sample only in v1), rate limit and daily cap behavior, the eval set, and the MCP App frame width (420, floor 360) are all settled in `docs/decisions.md`, which wins over this log.

## Sample data

- **The catalog renders from sample JSON with anonymized, handle-shaped placeholder names.** Real repo names stay (vercel/next.js, facebook/react, tailwindlabs/tailwindcss, vitejs/vite).
- **The app itself shows only live GitHub API data.** No sample value reaches a composed screen.
- **The design sheets are unchanged.** They keep real public maintainer handles with illustrative numbers, consistent across sheets and dated as if today were Oct 8 2026, as design references only. `ellie-hart/tidycsv` is an invented repo for the near-empty state. RateLimit's 5,000 an hour is GitHub's documented limit; its times are illustrative. Evals scores, latencies and model names are placeholders until the eval set runs.
