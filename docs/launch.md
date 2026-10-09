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

## LinkedIn post

First line punchy, no link in the body, link in the first comment. Draft for the owner's approval:

> I built a UI that doesn't exist until you ask it a question.
>
> Paste any public GitHub repo. Ask "what's blocking the next release." An agent picks from a component catalog I designed and the screen assembles itself around the answer in under a second. Click anything and it rewrites in place instead of reloading.
>
> The part that surprised me: a small model deciding and real code rendering beats a frontier model generating pages, on every axis. Faster, cheaper, and the interface actually looks like one product.
>
> The catalog is 40+ components with five states and three densities each, a motion grammar where every entrance has an exit, and an eval harness that scores every composition. Open source, link in the comments.

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
