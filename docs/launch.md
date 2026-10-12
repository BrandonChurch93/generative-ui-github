# Launch

Phase 10. What ships besides the code.

## The 60-second video

One take if possible, 1080p, no narration, no music the owner doesn't own. Screen only, real browser, cursor visible.

1. 0 to 5s: landing. Cursor pastes `vercel/next.js` into the field.
2. 5 to 15s: the composed screen streams in for "What's blocking the next release?" Let the full entrance play: insight wipe, metrics counting, rows sliding, the chart drawing, the action card blooming. The latency counter lands.
3. 15 to 25s: click the hot "Failing checks" metric. The rewrite: the insight retypes, the survivor metric slides and recounts, rows leave left and arrive left, the chart re-emphasizes.
4. 25 to 35s: type "who's carrying this repo". The ContributorRank enters with the bus-factor band.
5. 35 to 45s: open the drawer. Route, latency with the compose step in the gradient, what the model chose, View the JSON.
6. 45 to 55s: paste a different repo (the viewer's own, if there is one handy). Show the warming screen's lanes for a few seconds, then the composed answer.
7. 55 to 60s: the catalog page, scrolling, one chart flipped to its table view. End on the About page title.

Record with reduced motion off, density comfortable, a 1440×900 window.

## README (root)

Order: one sentence; the video (as a GIF or a link); the thesis paragraph (model decides, code renders, with the cost numbers: minutes and 200k tokens per page for full generation vs under a second and ~40 output tokens here); the architecture diagram from the brief; the twelve questions; how to run it; how to install the packages with a 20-line example; the eval results table; what it is not (no private repos, no accounts); MIT.

## Portfolio page

Title: Generative UI for GitHub Repos. One line: "Paste a repo, ask a question, and the interface builds itself around the answer." The video. Three paragraphs: the pattern and why the catalog is the product; the rewrite (exits reverse entrances, survivors morph) and why it matters; the eval harness and what the decision model saved. Links: live app, GitHub, npm, the MCP App instructions. A row of four stills: a composed screen, the rewrite mid-flight, the catalog, the evals page.

### Draft for approval

**Generative UI for GitHub Repos**

Paste a repo, ask a question, and the interface builds itself around the answer.

[The video goes here once it is recorded (10.3).]

Most generative UI demos ask a model to write the page. This one never lets it. The model reads the question and the repo's numbers and answers with a composition: which components, in what order, and what matters most, in meaning only (tone, emphasis, density). It never writes HTML, a color or a size. Code checks every piece against its schema, binds the real figures, checks every number the model puts in a sentence, and draws the result from a catalog of 40 components I designed, each drawn in every state it can reach and at three densities. Because the model can only choose, the catalog is the product: an answer nobody designed still looks designed.

Clicking anything on the screen asks a follow-up, and the screen rewrites in place instead of reloading. The renderer diffs the new composition against the one on screen by stable id. Pieces that leave run their entrance in reverse, new pieces enter in reading order, and pieces that survive morph to their new value and place instead of remounting. Most demos fade one screen out and the next one in, which tells the reader nothing about what changed. Here the failing-checks metric you clicked stays on screen and recounts, so you watch the answer narrow.

An eval harness runs 99 questions three times through each of three setups and scores every answer on template choice, components, hot metrics, schema validity, data bindings, number checks and layout rules, plus latency and cost. The shipped setup has Haiku route each question to one of 15 templates and fill in the words, and sends only what no template fits to Sonnet. Against Sonnet composing every answer freely from the same catalog, it used the expected components in every case that checks them (Sonnet: 25%), at $0.0021 an answer against $0.0138, about a sixth of the cost. Haiku-only matches production on template, bindings and numbers at about a third of the cost; its misses are off-template copy-length rules; Sonnet earns its cost only on off-template rule compliance. Sonnet was faster, 4.8 s to done at the median against 6.2 s, because a template answer streams nothing until its fill returns; that is the next thing to fix. The twelve suggested questions on the five sample repos skip the model entirely and open from precomputed compositions.

Links:

- Live app: [production URL, from the owner after 10.1]
- GitHub: https://github.com/BrandonChurch93/generative-ui-github
- npm: `@genui-github/ui` and `@genui-github/renderer` [package links once 10.2 is published]
- MCP App: https://github.com/BrandonChurch93/generative-ui-github#mcp-app

Four stills, left to right:

1. A composed screen: `vercel/next.js` answering "What's blocking the next release?" at 1440 once the entrance settles. The insight sentence, four metrics with the two hot ones marked, the pull requests sorted by wait, the CI chart and the request-review action card.
2. The rewrite mid-flight: a frame just after the click on "Failing checks". The old rows leaving left, the insight retyping, the failing-checks metric sliding to its new place and recounting.
3. The catalog: `/catalog` on one component with its five states side by side, and a chart flipped to its table view.
4. The evals page: `/evals` with production's four figures, the latency chart and the comparison against Sonnet alone.

## LinkedIn post

First line punchy, no link in the body, link in the first comment. Draft for the owner's approval:

> I built a UI that doesn't exist until you ask it a question.
>
> Paste any public GitHub repo. Ask "what's blocking the next release." An agent picks from a component catalog I designed and the screen assembles itself around the answer in under a second. Click anything and it rewrites in place instead of reloading.
>
> The part that surprised me: a small model deciding and real code rendering beats a frontier model generating pages, on every axis. Faster, cheaper, and the interface actually looks like one product.
>
> The catalog is 40+ components with five states and three densities each, a motion grammar where every entrance has an exit, and an eval harness that scores every composition. Open source, link in the comments.

### Draft for approval

> I built a UI that doesn't exist until you ask it a question.
>
> Paste any public GitHub repo. Ask "what's blocking the next release." A small model picks a layout from a component catalog I designed, code binds the repo's real numbers into it, and the screen assembles itself around the answer. The suggested questions on the sample repos open instantly; a repo nobody has asked about yet takes about 6 seconds. Click anything and it rewrites in place instead of reloading.
>
> The part that surprised me: a small model choosing from a fixed catalog beat a frontier model composing freely from the same catalog. Across 99 test questions, run three times each, it picked the expected components and bound the right numbers every time. Sonnet picked them 25% of the time and cost six times as much. Sonnet was faster, 4.8 seconds to 6.2 at the median, and that is the next thing to fix.
>
> The catalog is 40 components, each drawn in every state it can reach and at three densities, with a motion grammar where every entrance has an exit and an eval harness that scores the composer across three model setups. Open source, link in the comments.

First comment: the GitHub link, https://github.com/BrandonChurch93/generative-ui-github, and the live app once it has a URL.

What changed and why (figures from `packages/evals/results/2026-10-12-*.json` since the release run, the table in `docs/status.md` and `README.md`):

- "assembles itself around the answer in under a second" became two figures. The twelve golden questions on the five sample repos open from precomputed compositions with no model call (2 ms in a production build), so "instantly" is true for those. A live answer finished at 6.2 s p50 in the production run, so a fresh repo says "about 6 seconds".
- "An agent picks from a component catalog" became "a small model picks a layout": on the shipped path Haiku routes to one of 15 templates and fills the words, and the system binds the numbers. Sonnet composes only off-template.
- "beats a frontier model generating pages" became "beat a frontier model composing freely from the same catalog". The eval compared Sonnet composing from the same registry, not full-page generation; the page-generation cost (minutes and hundreds of thousands of tokens) comes from the brief and was never measured here.
- "on every axis. Faster, cheaper" is false and is gone. Production won on components (100% against 24.9%), schema (100% against 88.7%), rules (100% against 91.1%) and cost ($0.0021 against $0.0138 per answer, 6.5 times). Sonnet was faster: 4.8 s against 6.2 s to done, 2.6 s against 6.0 s to the first piece. The post now says so. Bindings are no longer compared: Sonnet alone skips routing by design, so template and bindings are not scored for it, and the post's "bound the right numbers" is production's own figure.
- "the interface actually looks like one product" was cut: the evals do not measure it, and the component and binding figures make the stronger, checkable claim.
- "40+ components" became "40": the registry holds exactly 40 (27 components plus 13 layout primitives such as Stack, Grid and Section), and `packages/ui/src/components/` has 41 folders because Sparkline is a part of Metric, not a registered component.
- "with five states and three densities each" became "each drawn in every state it can reach and at three densities". 16 of the 27 leave out one or more states with a written reason (warming for most), and the 13 layout primitives draw one way, so "five each" is not true.
- "an eval harness that scores every composition" became "scores the composer across three model setups". The harness scores eval runs (production, Sonnet alone, Haiku alone; `pnpm evals:check` reruns the 60 golden cases as a regression gate); it does not score live compositions.
- "Open source" stays, on the assumption the GitHub repo is public at launch.

## About page in the app

Idea, how it was built (the four layers), the decision-model finding with numbers from the eval run, the design system (link to the catalog), links to GitHub, npm, the MCP App, the portfolio and LinkedIn. The footer privacy line.

## Checklist before announcing

- [ ] Every golden question on every sample repo composes from production with no model call (check the built block).
- [ ] A fresh live repo composes within the visitor limit and shows the warming screen correctly.
- [ ] The daily cap is set and the cached-only mode has been seen once in production.
- [ ] npm packages install in a scratch project.
- [ ] The MCP App works in Claude Desktop on the owner's machine.
- [ ] The catalog has zero console errors in production.
- [ ] Lighthouse mobile: performance ≥ 90, accessibility ≥ 95.
- [ ] No real person's invented numbers anywhere: sample repos show live data; the catalog shows anonymized handles.
- [ ] The video is uploaded and plays.
