# Phase 4 · Data layer

Read `CLAUDE.md`, `docs/plan.md` Phase 4, `docs/data-layer.md` (all of it), `docs/schemas.md` sections Measure catalog and WarmingStatus, `docs/golden-questions.md` (for the template needs in 4.0), `docs/decisions.md` section Data.

Confirm `.env.local` has `GITHUB_TOKEN` before starting; if not, stop and write status. Build in the plan's order. Record fixtures from real calls once and test against the fixtures after that, so tests never hit the network. The 202 handling and the backoff are the part to get exactly right.

Task 4.5 is real calls: verify the five facts, write the answers with today's date into `docs/data-layer.md`. If a fact is wrong, adjust the fetcher and note the change in `docs/decisions.md`.

Run `pnpm samples:refresh` for the five sample repos and commit the JSON files. Print the request count. Continue straight into Phase 5.
