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

## Grill findings — 2026-05-30

Adversarial review of the explorer plan (recommendation: finish, estTaskCount 0,
openspecDelta none). Verified against the live tree on `main`.

**Surviving findings:**

- **MAJOR — `estTaskCount: 0` / `finish` is internally contradictory.** The
  gate-half is genuinely done (the five-command chain
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm lint:md` was
  run during this review and exits 0). But Requirement 2 (Final Playwright
  Re-Sweep, 0 console ERRORS per role) is real, undone manual work mandated by
  this change's own spec delta — tasks FGR-S1..S5 plus sign-off FGR-X1/X3.
  Realistic remaining count is ~6, not 0. Honest currentState is **partial**.

- **MAJOR — `openspecDelta: none` is wrong; tasks/spec describe a stale
  toolchain.** Actual `package.json`:
  `"lint": "biome check . && eslint . && pnpm lint:prisma:typecheck"`. Task
  FGR-G2 still calls this "the Turbo `lint` task" — there is no turbo `lint`
  task. Actual `"lint:md": "markdownlint-cli2 \"README.md\""` (README only);
  task FGR-G5 claims it lints `.planning/**` (excluding local-archive) — false.
  Spec Requirement 1 justifies including `lint:md` "so planning docs are clean"
  — false, it never touches planning docs. FGR-G2, FGR-G5, and the Req-1
  justification must be corrected to match `package.json` before sign-off.

- **MINOR — `lint:md` is a hollow gate.** `markdownlint-cli2 "README.md"`
  reports `Linting: 0 file(s)` / `0 error(s)` — README.md is filtered out by
  `.markdownlint.json`, so the command lints nothing and passes vacuously.
  Exit 0 here proves nothing. This both weakens the gate and falsifies the
  spec's "planning docs are clean" rationale.

- **MINOR — `gatesSufficient: true` is wrong for this change.** The five
  commands prove only the gate-half. Requirement 2 (per-role console sweep) is
  not exercised by any gate command; it needs Playwright execution against a
  live dev server. Plain gates do NOT prove this change done.

- **INFO — gate result is perishable.** `enable-biome-recommended-ruleset` and
  `markdown-format-only` (commit fd61c91f) are the separate
  lint-toolchain-ownership (A+C) track, plan-only/deferred — NOT defer-uat
  Waves 2–4, so not new `dependsOn` edges. But if either lands later it changes
  `biome.json` (recommended:true flip) or `lint:md` scope (markdownlint→Prettier
  move), which would invalidate this "final" sign-off. Re-run the gate after any
  toolchain change.

**Confirmed-correct explorer claims:** blastRadius low; sharedFiles [] (this
change touches only its own proposal/tasks/spec); `dependsOn` on the parent
`defer-uat-codequality-vercel-2026-05-26`; spec delta uses ADDED (correct, since
the parent capability is unarchived and MODIFIED would fail --strict). The eight
Wave 2–4 commit hashes cited by the explorer all exist in `main`.

**Revised recommendation: finish** (not done). Correct the stale toolchain
descriptions in FGR-G2/FGR-G5 and Requirement 1, then execute the Playwright
re-sweep (FGR-S1..S5) before archiving. Do not cancel/archive — the sweep is a
required, completable acceptance artifact. Verdict: needs-revision.
