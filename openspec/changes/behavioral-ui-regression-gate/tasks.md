# Tasks

Gates after every code step: `pnpm typecheck && pnpm lint && pnpm test`.

## 1. Generate the durable `lead` Scenario Catalog

- [x] 1.1 Decide the home/naming (`e2e/catalog/<role>.yaml`) and add a short
      `e2e/catalog/README.md`: behavior-anchored, `role · route · intent` +
      Given/When/Then prose, no `file:line`, durable high-level (not exhaustive),
      generated + human-reviewed. Includes a worked-example format contract and
      the verified `lead` route denominator (from the SSR layout guards).
- [x] 1.2 Generator written:
      `openspec/changes/behavioral-ui-regression-gate/workflow/generate-catalog.workflow.mjs`.
      Code-reading (not live-DOM — that's the Driver), self-discovers the role's
      reachable routes from the SSR layout guards, fans out per route (Haiku),
      emits the YAML `role x route x intent` skeleton with NO `file:line`, and
      runs an entry-point completeness critic + coverage matrix. The parked
      backend+`file:line` generator was rejected as the base (rewrite, not
      retarget); the parked `ux-catalog` live-DOM script seeds the Driver (task 3).
- [x] 1.3 Run the Haiku fan-out for the `lead` surface (one agent per route, each
      navigating large files to their action surface — tRPC mutation call-sites +
      action components — not reading linearly) → draft `lead` catalog. Done
      2026-06-04: `e2e/catalog/lead.yaml` (10 routes, 41 intents).
- [x] 1.4 Run the **entry-point** completeness-critic + coverage matrix (every
      `role × route` has ≥1 intent scenario — NOT per-element) with its bounded
      repair loop; human-review the generated diff for behavior-only anchoring (no
      `file:line`, no implementation detail) and any uncovered role/route. NOTE:
      route-set completeness rests on this human review, not the critic — the
      critic only checks intents-per-route, not that Discover found every route.
      Done 2026-06-04: review caught 3 defects the critic could not (2 dropped
      routes, a 5-way id collision, 2 out-of-role intents) — all fixed; see
      `e2e/catalog/_lead-coverage.md`.
- [x] 1.4b Harden the generator from the 1.4 findings (so the misses do not recur
      on `head`/`admin`/`viewer`): a mechanical `find page.tsx` CENSUS denominator
      that Discover must fully account for (route-or-excluded-with-reason, asserted
      in-script before extract), plus a deterministic id-uniqueness assert gating
      the repair loop. Done 2026-06-04 in `generate-catalog.workflow.mjs`.
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
