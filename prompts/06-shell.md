# Phase 6 · App shell

Read `CLAUDE.md`, `docs/plan.md` Phase 6, `design-system/decisions.md` section Screens, `docs/decisions.md` section Screens, `design-system/motion.md` section Entrance, `design-system/screens/README.md`, and the component READMEs for WarmingUp, Form and TextInput.

Open each screen under `design-system/screens/` in Playwright before building it; they are the reference renderings with their CSS beside them. The chips on the landing are the twelve golden questions, not the mock's wording. Build the landing, the composed screen, the chrome choreography, the tray with the density control, the drawer, the warming, rate-limit, daily-cap and near-empty screens, click-to-recompose, mobile rules, the returning-visitor offer, the overlay, the footer, and the accessibility pass. Two left edges, one rule: chrome on the container edge, everything read on the content edge.

Dev query flags force each special screen (`?force=warming`, `?force=ratelimit`, `?force=cap`, `?force=empty`). Run `pnpm a11y` on every screen. Commit, write `docs/status.md`, stop at GATE 4.
