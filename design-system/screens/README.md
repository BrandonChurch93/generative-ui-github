# Screens

Reference renderings of the seven fixed screens and three stress compositions, exported from the design canvas. Open any `.html` in a browser; `genui.css` (component styles the screens share) and `shell.css` (the chrome) sit beside them and load relatively. The fonts load from Google Fonts.

| File | Screen |
| --- | --- |
| Landing.html | the landing page: hero field, samples, question groups, the scaled preview |
| Main.html | a composed screen: release-blockers on vercel/next.js |
| Drawer.html | the "how this was built" drawer open |
| HowItWorks.html | the landing with the overlay open |
| Warming.html | the GitHub 202 state |
| RateLimit.html | GitHub rate limit reached |
| DailyCap.html | the daily spend cap reached, cached-only mode |
| NearEmpty.html | a repo with almost no data |
| Catalog.html | the component catalog page |
| Evals.html | the eval results page |
| About.html | the about page |
| MCPApp.html | the composed regions inside a 420px frame |
| Carrying.html | stress composition: who's carrying this repo |
| CISlower.html | stress composition: is CI getting slower |
| NewContributor.html | stress composition: where would a new contributor start |

These are references, not production code. Build from the component READMEs, `docs/schemas.md` and the tokens; compare the result to these in Playwright. Where a screen's chip wording or sample data disagrees with `docs/golden-questions.md` or `docs/decisions.md`, the docs win.
