# Phase 3 · Renderer

Read `CLAUDE.md`, `docs/plan.md` Phase 3, `docs/schemas.md` sections The UI description, Shared enums, Stable ids, Validation pipeline, `docs/composer.md` sections Composition rules and Sample compositions, and `design-system/motion.md` sections Entrance, Rewrite, Update.

Write the three fixtures first from the bound values in `docs/composer.md`; they are the test data for everything else. Build the format, the streaming parser, validation with fallback, the React renderer, the entrance choreography, the diff engine, the rewrite choreography, the update path, the four interaction event kinds, the A2UI adapter, the reduced-motion branches, and the package builds.

The rewrite is the heart of this project. The test that matters: between fixtures 1 and 2, the DOM node for `metric:failing-checks` is the same object before and after (it morphed, it did not remount), and its number counted from 1 to 2 while its delta crossfaded. Assert node identity, not just presence.

Publish-readiness: `npm pack` both packages and render fixture 1 from the tarballs in a scratch Vite app under `/tmp`. Commit, write `docs/status.md`, stop at GATE 2.
