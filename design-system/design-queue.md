# Design queue

What gets designed in Claude Design, what goes code-first from the tokens, and the order. Each designed component is done at all three densities with its skeleton, empty, error and warming states before the next one starts.

## Status

All fourteen are designed at three densities with every state, and synced into this system. Sheets live in the [Metric](https://claude.ai/artifact/TXC5ZhgUNtxTxpL4FFAKym), [StatusList](https://claude.ai/artifact/V3zJBX5tFEn58zFdGE61RV) and [Insight](https://claude.ai/artifact/UUtfzsGqvLBYc6YZL7B6dN) canvases and in [Generative UI components](https://claude.ai/artifact/Y1VwMbCVASqupxjZ8k3mLK) (4 to 14, one page each).

The seven fixed screens and the three stress compositions are mocked as fluid pages in [Generative UI screens](https://claude.ai/artifact/RwvQ4YDgJYVWqae1TtpkwK), each checked at 1440 and 390 wide, and exported as HTML into `design-system/screens/` for the build. The stress screens held one content edge under every mix, and found the gaps listed in the Decision log: layout past two cards, StatusList kinds beyond pull requests, narrow rules per component, and windows that disagree. The full audit came back clean on Oct 8 with two system changes (crit moved to crimson, sample data anonymized for the catalog), both in the Decision log. One item remains: the dark theme below, briefed when the build reaches the MCP App phase.

## Designed in Claude Design

Work the list top to bottom. The first three settle most of the system's decisions; everything after them goes faster.

| # | Component | Why it needs design | States to show |
| --- | --- | --- | --- |
| 1 | Metric | Sets the number, label and bar relationship the whole system inherits | default, hot, with suffix, skeleton |
| 2 | StatusList | Sets the mark, title, meta, tag rhythm every list uses | pending, changes, failing, approved, empty (good, neutral), skeleton |
| 3 | Insight | The one sentence the model writes; its rule and source line | short, two lines, with code, skeleton |
| 4 | Timeline | Merged PRs with authors and size; the first vertical rhythm | 5 items, 1 item, empty |
| 5 | LineChart + Sparkline | Axis, grid, line, endpoint, legend at three widths | one series, two series, with failure bars |
| 6 | Distribution | Response-time histogram with a "you would wait here" marker | wide, narrow |
| 7 | Comparison | Two periods side by side with signed deltas | 4 pairs, 2 pairs |
| 8 | ContributorRank | The bespoke bus-factor piece: bars per person, the load-bearing wall idea | 8 people, 3 people |
| 9 | Heatmap | Punch card, weekday by hour | full, sparse |
| 10 | ActionCard | Heading, copy, primary and secondary, confirm line | idle, confirming, done |
| 11 | Form + TextInput + Select + FilterChips | The input family, designed together | default, focus, error, filled |
| 12 | Steps | New-contributor guidance | 4 steps, with links |
| 13 | WarmingUp | The GitHub 202 state; deliberately beautiful | first visit, retry |
| 14 | DiffView + FileTree | Code surfaces | small diff, large diff collapsed |

## Code-first from the tokens

Surface, Section, Stack, Grid, SplitView, Drawer, Tabs, Heading, Text, Callout, List, KeyValue, ActivityFeed, Progress, Checklist, BarChart, Avatar, PersonList, CodeBlock, Button, EmptyState.

Buttons and chips are already settled in the recompose study and appear in this system as components.

## Fixed screens to mock

After the components, the shells around them:

1. Landing: repo input, five sample repos, twelve suggested questions. The empty state teaches; no banner.
2. Composed screen shell: eyebrow, question, built block, question chips, the "how this was built" drawer.
3. Warming up, rate limit and daily cap (cached-only mode), and the near-empty repo state.
4. Catalog page: every component rendered from its sample JSON.
5. Eval results page.
6. About page: idea, architecture, links.
7. The MCP App view: the same renderer in a narrow frame.

Then three stress compositions: "who's carrying this repo," "is CI getting slower," "where would a new contributor start."

## Last: dark theme

In scope for v1 and needed for the MCP App phase. A second theme in tokens.json, with every contrast figure redone on dark grounds. It gets its own brief when the build reaches that phase.

## Working in Claude Design

Open a design session, tell it to use this design system by name, and paste one component request at a time. A request that works:

> Use the Generative UI design system. Design the Metric component at compact, comfortable and spacious density, showing default, hot (blocking), with-suffix, and skeleton states. Number in the metric style, label in the label style, a 3px accent gradient bar along the bottom edge that reads as something that extended into place. Hot uses the crit-fill border at 35% and the card-hot shadow. No em dashes. Show all twelve variants on one artboard, labeled.

Review against the anatomy checklist in the README before accepting. When a decision changes a token, change it here first, then regenerate the component.
