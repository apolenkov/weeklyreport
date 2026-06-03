# Behavioral UI Regression Gate

## Why

Static gates (typecheck/lint/test/build) are provably blind to a class of
runtime behavior: an autofix once turned DI-injected classes into `import type`
and broke NestJS boot, and every static gate stayed green. We need a behavioral
UI gate that exercises the real app per role. The earlier attempt — an
AI-generated `Coverage Catalog` bound to `file:line` — was deferred because the
links rot on the first refactor; this change takes the durable half instead:
behavior-anchored scenarios compiled to deterministic specs.

## What Changes

- Establish **canonical Gherkin `.feature`** files as the durable source of
  truth for UI behavior (`role + route + Given/When/Then`, anchored to
  observable behavior, no `file:line`). One per role/area, under `e2e/`.
- A **Haiku fan-out Workflow compiles each `.feature` into a deterministic
  Playwright `*.spec.ts`** once per scenario. CI runs the specs with **no LLM at
  run time** (see ADR 0001). Agent interpretation is reserved for discovery and
  authoring, never the recurring gate.
- A **per-role sweep** (`lead` → `head` → `admin` → `viewer`) via the existing
  `/auth/dev-login`: asserts 0 console errors, key DOM by `role`/`aria`, dialog
  keyboard-closability, and runs `@axe-core/playwright` (already a dependency).
- Seed the canonical `.feature` **by hand, not by generator**: promote the `ok`
  rows from the archived `feedback-log.md` plus the ~40 product-behavior
  OpenSpec `#### Scenario:` blocks. The feedback-log table stays as the quick
  intake format during manual UAT; findings graduate into `.feature`.
- **BREAKING (test infra):** remove the current UI e2e harness under `e2e/`
  (`auth.setup.ts`, `fixtures.ts`, `playwright.config.ts`, `regression/`,
  `helpers/`, `visual/`, and the `test:e2e` / `test:e2e:ui` scripts), to be
  regenerated from the canonical `.feature`. The hard-won `dev-auth` role-login
  plumbing is recovered from git history, not re-derived. **Integration tests
  (`e2e/integration/*`) and all unit tests (vitest, incl. the VA-0a a11y RTL
  tests) stay.**

## Capabilities

### New Capabilities

- `behavioral-ui-regression-gate`: the canonical `.feature` source of truth, the
  compile-to-deterministic-specs rule, and the per-role sweep gate (console
  errors, DOM, dialog closability, axe a11y).

### Modified Capabilities

<!-- none: this does not change requirements of existing specs. The deferred
     Coverage Catalog (file:line drift gate) remains owned by
     establish-scenario-catalog and is explicitly out of scope. -->

## Impact

- **Removed:** `e2e/` UI harness (listed above) + `test:e2e`/`test:e2e:ui`
  scripts. Recoverable from git.
- **Kept:** `e2e/integration/*`, `playwright.integration.config.ts`, all vitest
  unit tests.
- **New:** `e2e/**/*.feature` (canonical), regenerated `e2e/**/*.spec.ts`,
  `pnpm test:uat` runner, a Haiku compile Workflow.
- **Dependencies:** `@playwright/test`, `@axe-core/playwright` (both present).
- **Out of scope:** the `file:line` Coverage Catalog / drift gate (stays
  deferred in `establish-scenario-catalog`); unicorn off-list / ratchet-lint.
