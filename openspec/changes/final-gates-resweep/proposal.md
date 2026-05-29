# Final Gates + Role Re-Sweep

## Why

This is Wave 5 — the last change to land in the
`defer-uat-codequality-vercel-2026-05-26` track. Waves 2–4 land bug fixes,
structural refactors, dependency bumps, and tooling work. Before the track can
be considered done, the repository needs one durable, unambiguous acceptance
bar that proves everything is green at once and that no role regressed in the
browser.

The parent change (`uat-quality-gates`) sketched a four-command gate and a
console-error sweep. This change pins the final, authoritative version of that
bar: a five-command chain that adds `pnpm build` and `pnpm lint:md`, plus a
precise console-error classification (0 ERRORS; warnings logged but allowed;
the favicon 404 ignored). Without a single codified acceptance gate, "done" is
a matter of opinion per session.

## What Changes

- Define the final acceptance gate as a single five-command chain that MUST all
  exit 0:
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm lint:md`.
- Define a final Playwright re-sweep across all four roles
  (lead / head / admin / viewer) requiring **0 console ERRORS**, with warnings
  logged (not failing) and the favicon-404 request explicitly ignored.
- Provide a re-sweep checklist (per-role screen list + the dev-login entry
  points) so the sweep is reproducible.
- No code, config, or dependency changes. Acceptance criteria + re-sweep
  checklist only. This is the final sign-off gate, not a refactor.

## Impact

- Affected specs: `uat-quality-gates` (ADDED requirements only; this change is
  the explicit final-gates extension of the parent capability).
- Affected packages/files: none modified. The gate exercises existing scripts
  in `package.json` (`typecheck`, `lint`, `test`, `build`, `lint:md`) and the
  existing Playwright project under `e2e/`.
- Risk: low. This is a verification/acceptance artifact. The only failure mode
  is that running the gate surfaces a real regression from an earlier wave — in
  which case the offending wave's change is reopened, not this one.
- Sequencing: this change is gated by completion of Waves 2–4; it is the last to
  land in the track.
