# Evals

`packages/evals`. The real test suite. It answers the question a lab engineer asks first: does the composer pick the right pieces, bind the right data, and do it fast and cheap?

## The set

`packages/evals/set/*.json`, one file per case:

```ts
{
  id: 'golden-02-nextjs',
  repo: 'vercel/next.js',
  question: "What's blocking the next release?",
  kind: 'golden' | 'paraphrase' | 'off-template' | 'cannot-answer' | 'follow-up',
  expect: {
    template: 'release-blockers',              // or 'off-template'
    components: ['Insight', 'Metric', 'Metric', 'Metric', 'Metric', 'StatusList', 'LineChart', 'ActionCard'],
    hot: ['metric:awaiting-review', 'metric:failing-checks'],
    bindings: [{ id: 'metric:failing-checks', prop: 'value', equals: 'ctx.checks.failing.length' }],
    sources: ['pulls', 'checks']
  }
}
```

Counts: 12 golden × 5 repos = 60; 20 paraphrases on next.js; 10 off-template; 3 cannot-answer; 6 follow-ups (one per click type). 99 cases. The set is authored in Phase 5 (task 5.0) because the composer's tests use it; Phase 7 builds the scorers and runner.

Paraphrases are real rewordings ("what's holding up 16.2", "release blockers?", "why hasn't the milestone shipped"). Off-template examples: "which files change most often", "who reviews the most PRs they didn't write", "how long do docs PRs wait compared to code PRs". Cannot-answer: traffic, a private repo, a question about a repo that doesn't exist.

## Scorers

| Scorer | Measures | Pass |
| --- | --- | --- |
| template | classified template equals expected | exact |
| components | F1 between the composed component multiset and expected | ≥ 0.85 |
| hot | the hot metric ids match | exact set |
| schema | every piece validates | 100% |
| bindings | each `equals` expression evaluated on the context matches the prop | 100% |
| numbers | number validation found zero mismatches | 100% |
| rules | zero composition-rule drops | 100% |
| latency | ms to first piece, ms to done | reported |
| cost | USD per composition | reported |

## Runs

`pnpm evals:run --model <haiku|sonnet|production> --runs 3` writes `packages/evals/results/<date>-<model>.json` with every case's scores and the aggregates. `production` is the real path (Haiku classify + fill, Sonnet off-template). `sonnet` composes everything with Sonnet off-template style, to show what the decision model saves. `haiku` runs Haiku everywhere, to show where it breaks. `sonnet` skips routing by design, so template and bindings are not scored for it (`NOT_SCORED` in `packages/evals/src/run.ts`; the results file carries the reason and `/evals` prints "not scored · no routing"). `pnpm evals:rescore <file>` reapplies that to a recorded file with no model call.

Three runs each so variance shows. The results page shows mean and spread.

## Results page

`/evals` in the app: per model, a table of the aggregate scores; a Distribution of latency-to-done; a Comparison of `production` vs `sonnet` on cost, median time to done, components and rules (in the same whole percents and words as the per-model tables; Components shows both its figures, "25% pass · 0.75 mean F1", in both places); the three-model finding in one sentence under the tables, shown only while the runs bear out each clause; a StatusList of the failing cases with their reasons; the date and the model ids. The page renders catalog components directly with system-bound props (the way the renderer fixtures do), not through the composer's measure schema, so Distribution and Comparison show eval numbers here.

## Regression gate

`pnpm evals:check` reruns the 60 golden cases on `production` once and fails if template accuracy or bindings drop below the last recorded run. Run before any commit that touches `packages/composer` or a template.
