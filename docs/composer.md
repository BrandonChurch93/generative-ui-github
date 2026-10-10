# Composer

`packages/composer`. Question plus data in, a streamed UI description out. The model decides, this package enforces.

## Pipeline

```
question, repo
  → classify (Haiku, ~300ms)        → { template | 'off-template', confidence, params }
  → build data context               → DataContext for that template (or the overview set for off-template)
  → if template: run the template    → tree with prose slots empty
      → fill prose (Haiku)           → Insight sentence; LineChart, Comparison and BarChart findings; Heatmap summary; Metric deltas
  → else: compose (Sonnet, streamed) → tree
  → validate                          → schema, rules, numbers
  → stream                            → JSONL, insight first, metrics, then regions, then done + built
```

Latency targets on a cached sample: classify 300ms, fill 600ms, first piece on screen under 1s, done under 2.5s. Off-template: first piece under 2s, done under 6s.

## Classifier prompt (Haiku)

System: the 15 template ids with one line each (from `docs/golden-questions.md`), the rule that a question about a specific PR number, person or check is a follow-up template, and the instruction to return `off-template` when none fits with confidence under 0.6.

User: the question, the repo's one-line summary (name, language, stars, open PRs, open issues, last push), and the `from` piece if the question came from a click.

Output, enforced with a JSON schema: `{ template: string, confidence: number, params: Record<string, string | number> }`. `params` carries things like the PR number, the handle, the branch, the window.

## Templates

One module per template in `packages/composer/src/templates/<id>.ts`:

```ts
export const releaseBlockers: Template = {
  id: 'release-blockers',
  needs: ['repo', 'pulls', 'milestones', 'checks', 'workflowRuns'],
  density: 'comfortable',
  compose(ctx) { /* returns a Composition with prose slots as { slot: 'insight' } etc. */ },
  proseSlots: ['insight', 'metrics.*.delta', 'side.linechart.finding', 'side.comparison.finding', 'main.heatmap.summary'],
  asks: (ctx) => [/* up to 4 follow-ups */],
}
```

A template never calls a model. It is deterministic from the context. The fill step then writes the prose slots in one Haiku call with the context and the slot constraints (max chars, must cite sources).

## Off-template composition (Sonnet)

System prompt, in order, cached as one block:

1. The role: "You compose an interface from a catalog to answer a question about a GitHub repo. You output JSONL messages. You never output HTML, CSS, colors or sizes."
2. The registry prompt (`registry.toPrompt()`).
3. The composition rules below, verbatim.
4. The regions and their purposes, the height classes and what pairs with what.
5. Three worked examples (release-blockers, contributors, ci-trend) as JSONL.

User: the question, the data context as JSON (under 3,000 tokens, pruned to the shapes relevant to the classified intent cluster), the frame width if in the MCP App.

## Composition rules (enforced in code, repeated in the prompt)

1. The Insight is always the first piece and always cites `sources`.
2. At most four Metrics; at most two `hot`.
3. At most one ActionCard; always the last piece; left out when there is nothing worth doing.
4. `main` and `side` are two columns. Each column holds one piece, or a stack of two when the second is `fixed` or `plot`. Two `grows` pieces never share a row; a second `grows` stacks below the first in `main`. A FilterChips may sit above its `grows` target in the same column. A chart beside a `grows` list is the common pairing. The template table in `docs/golden-questions.md` names which pieces stack.
5. A Metric never repeats a ContributorRank band's words or a Comparison verdict.
6. A Steps `ask` never recomposes a list already on screen.
7. Two categorical series at most on any chart; failures go in the LineChart strip.
8. Every number in prose appears in the cited data. A violation replaces the prose with the system sentence.
9. Density: `compact` when the question asks for a quick or short answer; `spacious` when it asks to walk through or explain; else `comfortable`.
10. Follow-up `asks`: zero to four, phrased as a person would type, each answerable by a template.

Rule violations are dropped with a logged reason; the composition still renders.

### Layout: one piece in main, two in side

When `main` holds one piece and `side` holds two, the two columns cannot come out level: the side stack runs past the main card and leaves dead space under it (on vercel/next.js, a 108px CI workflows card beside 711px of chart and comparison). The renderer then drops the split and stacks the side pieces under the main piece, one column at full width, in order: main, then side's first, then side's second. The ActionCard below takes the full width with them, so its edges still line up. The pieces keep their regions, so nothing remounts and rule 4 still counts each column as it was composed. Five golden templates produce the case: `ci-trend`, `contributors`, `new-contributor`, `overview` and `responsiveness`.

The other reading, stretching the lone main card to the row's height, was tried and set aside: it moves the dead space inside the card instead of removing it (the one-row CI workflows card would stand 711px tall with 600px of nothing), and it does so on every sample. Under 1024px the split is one column already, so phones and tablets are unchanged. The rule lives in `packages/renderer/src/react/Renderer.module.css` and reads each region's `data-count`; a free composition that streams its second side piece late reflows to one column when that piece arrives.

## System sentences

Written by code, never the model, used in the Insight slot:

- Number mismatch: "The model's figure didn't match the data. Here is what the data shows." (then the template's default insight if available)
- Off-template fallback when Sonnet fails: "Couldn't write an answer to this question." with the cause in meta and Try again.
- Warming: "GitHub is still counting `<repo>`." in the insight region, with the WarmingUp lanes card in `main` and the other regions empty until stats land.
- Rate limit: "GitHub's rate limit resets at `<time>`." with the unavailable mark.
- Daily cap: "Live questions are paused for today. Sample repos and cached answers still work."
- Near-empty repo: "`<repo>` has `<n>` commits and no releases, so most of this is empty. Here is what there is."
- Escalation reasons (decision 50), shown in the built block: "off-template · no template matched", "off-template · change point found", "off-template · follow-up with no template".

## Validation

Runs on every composition before streaming, in this order: JSON shape → registry membership → per-component Zod → composition rules → number validation → id derivation. The validator is shared with the renderer so the client applies the same checks on anything that arrives.

## Cost accounting

Per call: input, cached-input and output tokens from the API response, multiplied by the price table in `packages/core/config.ts` (dated). Summed per composition into `built.costUsd`. Summed per day into the cap counter. The price table is the only place prices live.

## Sample compositions

Three compositions for the renderer tests and the three-screen rewrite study, stored as JSON in `packages/renderer/fixtures/` with the bound values below (the fixtures carry system-bound props so the renderer can be tested without the data layer). All on vercel/next.js, milestone v16.2, anonymized handles.

1. `release-blockers`
   - Insight: "v16.2 is held by three pull requests waiting on review and one failing check on `canary`. The milestone closes in 4 days." sources open-prs, failing-checks, milestone-closes.
   - Metrics: `open-prs` 7 (delta "2 merged this week") · `awaiting-review` 3, hot (delta "oldest waiting 6 days", crit) · `failing-checks` 1 of 14, hot, ask → check-failures (delta "on canary", crit) · `milestone-issues-open` 4 of 19 (delta "15 closed", good).
   - main: StatusList pull × 5, scope milestone v16.2, sort wait.
   - side: LineChart `ci-p50`, 12w, failures on, finding "CI p50 rose from 13.2 to 18.4 min over 12 weeks".
   - action: ActionCard request-review, targets the three waiting PRs.
2. `check-failures` (reached by the click on failing-checks)
   - Insight: "Two checks fail on `canary`. `test-unit (windows)` has failed 4 of the last 5 runs." sources failing-checks, workflow-runs.
   - Metrics: `failing-checks` 2 of 14, hot (survivor: counts 1→2, delta rewrites to "both on canary") · `failing-since` 4 runs, hot · `ci-p50` 18.4 min · `flaky-rate` 14%.
   - main: StatusList check × 5, scope branch canary.
   - side: LineChart `ci-p50` (survivor, re-emphasized: failure strip comes forward).
   - action: ActionCard rerun-checks.
3. `contributors`
   - Insight: "Three people made 61% of commits in the last 90 days, and the bus factor is 2." sources contributors, bus-factor.
   - Metrics: `contributors` 48 · `bus-factor` 2, hot · `core-share` 38% · `awaiting-review` 3 (survivor from 1, ask → release-blockers).
   - main: ContributorRank commits, limit 8, wallTone risk.
   - side: LineChart two series, `core-share` (core) and `community-share` (community), 12w.
   - no action.

The rewrite tests assert: 1→2 morphs `metric:failing-checks` (same DOM node, number 1→2) and `linechart:ci-p50`, exits the other three metrics, enters three; 2→3 enters the ContributorRank and exits the StatusList; 3→1 morphs `metric:awaiting-review`.
