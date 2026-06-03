## Context

Static gates have shipped a runtime regression before (autofix → `import type`
→ broken NestJS DI), so a behavioral UI gate is needed. A full AI `Coverage
Catalog` (596 scenarios bound to `file:line`) was built and removed as premature
— the links rot on an MVP codebase. The reusable bits survive: the catalog
generator Workflows (parked) and a working per-role login helper (`dev-auth`,
currently under `e2e/`). The decision record is `docs/adr/0001`; terms are in
`CONTEXT.md` (Behavioral Scenario, Coverage Catalog, Role sweep).

## Goals / Non-Goals

**Goals:**

- A durable, behavior-anchored source of truth (`.feature`) that survives
  refactors.
- A deterministic, cheap-to-rerun per-role UI gate (`lead`/`head`/`admin`/
  `viewer`): 0 console errors, key DOM, dialog keyboard-closability, axe a11y.
- Use Haiku to do the expensive part once (author specs from `.feature`), not on
  every run.

**Non-Goals:**

- The `file:line` Coverage Catalog / drift gate (stays deferred in
  `establish-scenario-catalog`).
- Re-deriving `dev-auth` from scratch (restore from git).
- unicorn off-list / ratchet-lint work.

## Decisions

- **`.feature` (Gherkin) as the canonical artifact, not a table.** Gherkin's
  `Given/When/Then` forces precision and compiles unambiguously; the
  `feedback-log` table is great for fast intake but too loose to compile without
  Haiku guessing steps (which causes drift). The table remains the manual-UAT
  intake format; rows graduate into `.feature`.
- **Compile to deterministic specs; do not interpret live (ADR 0001).** A gate
  must give the same verdict for the same code. Agent-in-the-run-loop is
  non-deterministic, expensive per run, unbisectable, and "helpfully" masks
  regressions. Alternative (agent-interpreted) is kept only for discovery and
  authoring.
- **No BDD runner dependency.** The repo has no `playwright-bdd`/cucumber; rather
  than add one, Haiku emits plain `@playwright/test` `*.spec.ts` from each
  `.feature`. Keeps the run path standard and dependency-light. (Revisit a BDD
  runner only if hand-maintaining the `.feature`↔spec link becomes painful.)
- **Seed by hand, not by generator.** The code-derived generator produces the
  rotting `file:line` catalog. Seed the durable `.feature` from `feedback-log`
  `ok` rows + the ~40 product-behavior OpenSpec scenarios.
- **Remove the UI e2e harness now; keep integration + unit.** The current `e2e/`
  UI harness has zero specs already — only plumbing. Removing it (and restoring
  `dev-auth` from git when regenerating) gives a clean slate without losing the
  hard part. `e2e/integration/*` and vitest units are untouched.
- **Role order: `lead` first.** Largest UI surface; head/admin/viewer follow.

## Risks / Trade-offs

- **Compiled specs drift from intent if `.feature` and spec diverge.** →
  `.feature` is the reviewed source; the compile Workflow regenerates the spec
  from it, and a spec whose behavior no longer matches its `.feature` is a
  failing/edited spec, surfaced in review.
- **Haiku mis-compiles a scenario (wrong selector, vacuous assert).** → same
  guardrail proven on VA-0a: self-verify each spec runs green, plus a sampled
  adversarial vacuity review of risky specs; the gate's determinism makes a bad
  spec reproducible and fixable.
- **Removing `dev-auth` loses the cookie/role logic.** → it is committed;
  restore from git history rather than re-derive.
- **`.feature` becomes stale if manual-UAT findings are not promoted.** →
  feedback-log intake → `.feature` promotion is an explicit step; unpromoted
  findings stay visible in the log.

## Migration Plan

1. Land the canonical `.feature` (lead first) seeded from feedback-log + specs.
2. Restore `dev-auth` from git into the regenerated sweep harness; wire
   `pnpm test:uat`.
3. Haiku Workflow compiles `.feature` → `*.spec.ts`; self-verify + sampled
   vacuity review; run the per-role sweep green.
4. Remove the old UI e2e harness + `test:e2e`/`test:e2e:ui` scripts.
   Rollback: `git revert`/restore the removed `e2e/` files.

## Open Questions

- Final home/naming for `.feature` (`e2e/features/<role>.feature`?) and compiled
  specs (`e2e/regression/<role>.spec.ts`?) — settle during apply.
- Whether `head`/`admin`/`viewer` land in this change or follow-ups once `lead`
  proves the pipeline.
