# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`.

## 1. Generate the durable `lead` Scenario Catalog

- [ ] 1.1 Decide the home/naming (`e2e/catalog/<role>.yaml`) and add a short
      `e2e/catalog/README.md`: behavior-anchored, `role · route · intent` +
      Given/When/Then prose, no `file:line`, durable high-level (not exhaustive),
      generated + human-reviewed.
- [ ] 1.2 Retarget the parked generator
      (`openspec/changes/establish-scenario-catalog/workflow/*.mjs`) to emit the
      YAML skeleton and drop the `file:line` binding; confirm it discovers the
      entry-point surface itself.
- [ ] 1.3 Run the Haiku fan-out for the `lead` surface (one agent per entry-point
      slice; large files sub-sliced) → draft `lead` catalog.
- [ ] 1.4 Run the **entry-point** completeness-critic + coverage matrix (every
      `role × route` has ≥1 intent scenario — NOT per-element); human-review the
      generated diff for behavior-only anchoring (no `file:line`, no
      implementation detail) and any uncovered role/route.
- [ ] 1.5 Fold in the `ok` rows from the archived `feedback-log.md` that the
      generator missed; dedup. The feedback-log stays the quick manual-UAT intake.

## 2. Restore the sweep harness (no re-derivation)

- [ ] 2.1 Restore `dev-auth` (per-role login) from git history into the
      regenerated harness; confirm `lead`/`head`/`admin`/`viewer` login works.
- [ ] 2.2 Add a fresh `playwright.config.ts` for the UI sweep and wire
      `pnpm test:uat`; reuse `@axe-core/playwright`.
- [ ] 2.3 Confirm `e2e/integration/*` + `playwright.integration.config.ts` and
      all vitest unit tests are untouched and still run.

## 3. Build the Driver (human + AI agent)

- [ ] 3.1 Author the AI-agent Driver: a Workflow where one agent per role reads
      the catalog, drives the browser via the **Playwright MCP** through
      `dev-auth`, explores each route's elements/transitions at run time, and
      records anomalies (console errors, broken flow vs expected, layout, axe).
- [ ] 3.2 Add the human-Driver mode: render the same catalog as a per-role
      checklist for manual UAT, collecting pass/fail + notes in the same report
      shape.
- [ ] 3.3 Define the per-role **report** format (role · route · anomaly), and
      confirm it is non-blocking (produces a report, does not fail CI).
- [ ] 3.4 Run the `lead` sweep under the agent Driver; confirm a deliberately
      broken route (failed load / injected console error) shows up in the report.

## 4. Remove the old UI e2e harness

- [ ] 4.1 Remove `e2e/auth.setup.ts`, `e2e/fixtures.ts`,
      `e2e/playwright.config.ts` (old), `e2e/regression/` (old), `e2e/helpers/`,
      `e2e/visual/`, and the `test:e2e` / `test:e2e:ui` scripts — superseded by
      the regenerated sweep. Keep integration + unit.
- [ ] 4.2 Confirm gates green and `pnpm test:uat` (lead) runs after removal.

## 5. Extend to remaining roles + close out

- [ ] 5.1 Repeat 1+3 for `head`, then `admin`, then `viewer` (each lands
      separately, sweep reports per role).
- [ ] 5.2 Document the loop in `e2e/catalog/README.md`: manual-UAT findings →
      feedback-log intake → graduate into the catalog → regenerate.
- [ ] 5.3 Record phase 2 (freeze critical paths into deterministic specs;
      consider MBT) as deferred-until-stabilization — do NOT build it here.
- [ ] 5.4 `openspec validate behavioral-ui-regression-gate --strict` green;
      archive.

## Out of scope (do NOT do here)

- [ ] 6.1 (NOTE, not a task) The `file:line` Coverage Catalog / drift gate stays
      deferred in `establish-scenario-catalog`. Do not reactivate it here.
- [ ] 6.2 (NOTE, not a task) The deterministic frozen gate and formal Model-Based
      Testing are phase 2, deferred until the product stabilizes.
