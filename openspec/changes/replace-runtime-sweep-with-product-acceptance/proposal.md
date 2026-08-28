## Why

WeeklyReport needs trustworthy product acceptance, but the current exhaustive runtime layer has become a second software product: `e2e/runtime-sweep/` contains 859 files and about 141,620 TypeScript lines, while all other E2E code contains 85 files. Its 20-hour canary ceiling, continuation graph, custom supervisors, immutable ledgers, and AI-import protocol consume engineering time without producing proportionate product feedback.

## What Changes

- **BREAKING** Remove `e2e/runtime-sweep/`, all `test:runtime-*` commands, campaign supervisors, continuation/checkpoint protocols, custom evidence ledgers, lane orchestration, and AI report import.
- Introduce one smoke-only `e2e/acceptance/` Playwright contour built from one representative WeeklyReport lifecycle and the existing route catalog.
- Keep Vitest, focused integration E2E, seed-profile tests, production-build/CSP tests, and `e2e/sweep/`; reuse their proven helpers instead of creating another framework.
- Keep browser acceptance to basic role/route health plus one lead write -> head publish -> viewer read lifecycle with visible and persisted read-back assertions. Existing focused suites remain responsible for PDF, admin, detailed authorization, and edge-case coverage.
- Enforce hard complexity and duration budgets: at most 25 owned source files, at most 4,000 non-generated lines, 10-minute smoke, 15-minute route-health-plus-smoke acceptance, and 2-minute teardown on the reference Mac.
- Emit standard Playwright reports and failure artifacts only; bind release runs to Git SHA without custom hash chains or resumable campaigns.
- Reconcile and supersede active tasks whose acceptance language requires the retired runtime sweep.

### Non-goals

- No change to WeeklyReport product behavior, production APIs, auth, or data model.
- No mobile work; the six owner-deferred mobile changes remain deferred.
- No exhaustive interaction-graph traversal, combinatorial state proof, custom orchestration, or AI-owned acceptance authority.
- No deletion of ordinary product tests that remain fast, deterministic, and behavior-focused.

## Capabilities

### New Capabilities

- `bounded-product-acceptance`: Defines the compact WeeklyReport smoke contour, budgets, evidence, ownership, and cleanup contract.

### Modified Capabilities

- `uat-quality-gates`: Replaces open-ended/runtime-sweep final acceptance with bounded smoke, existing deterministic suites, and standard Playwright evidence.
- `scenario-catalog`: Makes the existing catalog the route-coverage source for the new contour without adding another execution framework.
- `behavioral-ui-regression-gate`: Consolidates browser regression ownership under the bounded acceptance contour.
- `sweep-runtime-correctness`: Preserves runtime/accessibility correctness requirements while removing dependency on the retired exhaustive runtime system.
- `directory-architecture-standard`: Removes runtime-sweep-specific structure and prevents a replacement test platform from regrowing without an explicit budget change.

## Impact

Primary impact is `e2e/`, package scripts, CI, gates, docs, OpenSpec, and external archive guidance. The change deletes roughly 142k lines, retires the incomplete `establish-exhaustive-runtime-sweep` track as superseded, and rewrites dependent closure tasks. Production code and schemas remain unchanged.
