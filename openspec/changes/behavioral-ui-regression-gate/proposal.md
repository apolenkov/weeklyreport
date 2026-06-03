# Behavioral UI Regression Gate

## Why

Static gates (typecheck/lint/test/build) are provably blind to a class of
runtime behavior: an autofix once turned DI-injected classes into `import type`
and broke NestJS boot, and every static gate stayed green. We need a behavioral
UI check that exercises the real app per role. The codebase is a pre-prod MVP
that refactors constantly, so the check must not rot on every refactor.

This change builds **phase 1**: a durable, behavior-anchored catalog executed by
a live Driver (human or AI agent) that **reports** what is broken per role. The
deterministic, blocking **phase 2** (freeze critical paths into Playwright specs)
is deferred until the product stabilizes. See `docs/adr/0001` for the decision
and its sources.

## What Changes

- Establish a durable, high-level **Scenario Catalog** as the source of truth for
  UI behavior: Behavioral Scenarios (`role + route + intent + Given/When/Then`),
  anchored to observable behavior, never to `file:line`. It is deliberately NOT
  an exhaustive enumeration of every element/state/transition — that is
  structure-anchored and rots; exhaustive coverage is the Driver's run-time job.
- **Generate** the catalog from the **code** entry-point surface (the role's
  reachable routes + their page/action components + SSR guards) via a **Haiku
  fan-out** (one agent per route, each navigating large files to their action
  surface rather than reading linearly), with a
  completeness-critic + coverage matrix to justify "covered everything", then
  human-review the result. Not hand-authored.
- Store the catalog as a **YAML skeleton** (`role · route · intent`) with the
  expected outcome written as Given/When/Then prose in a field — no BDD-runner
  dependency.
- Build the **Driver**: a swappable executor that runs the catalog against the
  live app, either as a human checklist or as an **AI agent driving the browser
  via the Playwright MCP** through `/auth/dev-login`. Built on our own tooling
  (Workflow + Playwright MCP), not an external agentic-testing product.
- Run a **per-role sweep** (`lead` first, then `head` / `admin` / `viewer`) that
  reports anomalies (console errors, broken DOM/flow, layout, axe a11y) per role.
  **Phase 1 reports; it does NOT block merges.**
- **BREAKING (test infra):** remove the current UI e2e harness under `e2e/`
  (`auth.setup.ts`, `fixtures.ts`, `playwright.config.ts`, `regression/`,
  `helpers/`, `visual/`, and the `test:e2e` / `test:e2e:ui` scripts), regenerated
  for the sweep. The hard-won `dev-auth` role-login plumbing is recovered from
  git history, not re-derived. **Integration tests (`e2e/integration/*`) and all
  unit tests (vitest, incl. the VA-0a a11y RTL tests) stay.**

## Capabilities

### New Capabilities

- `behavioral-ui-regression-gate`: the durable Scenario Catalog, its generation
  from code (DOM is the Driver's run-time job, not the generator's), the swappable
  Driver, and the per-role reporting sweep.

### Modified Capabilities

<!-- none: this does not change requirements of existing specs. The deferred
     file:line Coverage Catalog remains owned by establish-scenario-catalog. -->

## Impact

- **Reuses:** the catalog generator parked in `establish-scenario-catalog` (it
  already discovers entry points, fans out per slice, and emits a coverage
  matrix). This change retargets its output to the YAML skeleton and drops the
  `file:line` binding. `establish-scenario-catalog` keeps ownership of the
  deferred `file:line` Coverage Catalog; this change owns the durable behavioral
  path and the Driver.
- **Removed:** `e2e/` UI harness (listed above) + `test:e2e`/`test:e2e:ui`
  scripts. Recoverable from git.
- **Kept:** `e2e/integration/*`, `playwright.integration.config.ts`, all vitest
  unit tests.
- **New:** the YAML Scenario Catalog, the Driver (Workflow + Playwright MCP), a
  `pnpm test:uat` sweep runner.
- **Dependencies:** `@playwright/test`, `@axe-core/playwright` (both present),
  the Playwright MCP (already connected). No external testing product.
- **Out of scope:** the `file:line` Coverage Catalog / drift gate (deferred in
  `establish-scenario-catalog`); formal Model-Based Testing and the deterministic
  frozen gate (both deferred to phase 2, on stabilization).
