# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`.

## 1. Seed the canonical `.feature` (lead first)

- [ ] 1.1 Decide the home/naming (`e2e/features/<role>.feature`) and add a short
      `e2e/features/README.md` stating: behavior-anchored, no `file:line`,
      this is the source compiled to specs.
- [ ] 1.2 Promote the `ok` rows from
      `openspec/changes/archive/2026-05-26-uat-feedback-2026-05-26/feedback-log.md`
      into `lead` Gherkin scenarios (role + route + Given/When/Then).
- [ ] 1.3 Fold in the product-behavior subset (~40) of OpenSpec `#### Scenario:`
      blocks that apply to the `lead` UI; dedup against 1.2.
- [ ] 1.4 Review the `lead` `.feature` by hand for behavior-only anchoring (no
      `file:line`, no implementation detail).

## 2. Restore the sweep harness (no re-derivation)

- [ ] 2.1 Restore `dev-auth` (per-role login) from git history into the
      regenerated harness; confirm `lead`/`head`/`admin`/`viewer` login works.
- [ ] 2.2 Add a fresh `playwright.config.ts` for the UI sweep and wire
      `pnpm test:uat`; reuse `@axe-core/playwright`.
- [ ] 2.3 Confirm `e2e/integration/*` + `playwright.integration.config.ts` and
      all vitest unit tests are untouched and still run.

## 3. Compile `.feature` → deterministic specs (Haiku Workflow)

- [ ] 3.1 Author the compile Workflow: one Haiku agent per `lead` scenario emits
      a plain `@playwright/test` `*.spec.ts` (console-error assert, key DOM by
      role/aria, dialog Escape/Cancel closability, axe audit), self-verifying
      each spec runs green. No BDD-runner dependency.
- [ ] 3.2 Sampled adversarial vacuity review of the riskiest compiled specs
      (dialogs, multi-step flows) — catch passing-but-vacuous assertions.
- [ ] 3.3 Run the full `lead` sweep via `pnpm test:uat`; confirm deterministic
      green (run twice, identical verdict) and 0 console errors.

## 4. Remove the old UI e2e harness

- [ ] 4.1 Remove `e2e/auth.setup.ts`, `e2e/fixtures.ts`,
      `e2e/playwright.config.ts` (old), `e2e/regression/` (old), `e2e/helpers/`,
      `e2e/visual/`, and the `test:e2e` / `test:e2e:ui` scripts — superseded by
      the regenerated sweep. Keep integration + unit.
- [ ] 4.2 Confirm gates green and `pnpm test:uat` (lead) green after removal.

## 5. Extend to remaining roles + close out

- [ ] 5.1 Repeat 1–3 for `head`, then `admin`, then `viewer` (each lands
      separately, sweep green per role).
- [ ] 5.2 Document the loop in `e2e/features/README.md`: manual-UAT findings →
      feedback-log intake → graduate into `.feature` → recompile.
- [ ] 5.3 `openspec validate behavioral-ui-regression-gate --strict` green;
      archive.

## Out of scope (do NOT do here)

- [ ] 6.1 (NOTE, not a task) The `file:line` Coverage Catalog / drift gate stays
      deferred in `establish-scenario-catalog`. Do not reactivate it here.
