## Context

See `proposal.md`. The original runtime-sweep deletion left a second layer of route catalogs, UAT analysis, Playwright configs, integration journeys, acceptance lifecycle code, custom evidence, and test-specific gates. The owner has now retired that entire root `e2e/` platform rather than replacing it with a smaller harness.

The production PDF worker still uses the `playwright` runtime package and is not test infrastructure. Product-adjacent Vitest tests remain. Period dual-state, canonical role middleware, destructive-database guards, and deferred mobile scope are unchanged.

## Goals / Non-Goals

**Goals:**

- Make product source the repository's center of gravity.
- Keep production code readable, immutable by default, and explicit about roles and ownership.
- Keep tests close to product modules and free from production code-shape budgets.
- Delete separate browser/integration orchestration and its scripts.

**Non-Goals:**

- Recreating a smoke runner or manual checklist.
- Removing the production PDF browser runtime.
- Weakening product-source architecture, role, type, or code-quality gates.
- Removing focused product tests solely because their filename contains `integration`.

## Decisions

### 1. Delete the root E2E platform

Delete `e2e/` in full, including Playwright journeys, global setup/teardown, helpers, CSP and production-build scenarios, catalogs, acceptance, and integration configs. Delete `apps/web/uat-suite/` and all dedicated commands and CI jobs.

Alternative: retain one smoke. Rejected by the owner's final direction because even a reduced harness retains process, database, browser, cleanup, and evidence ownership outside the product.

### 2. Preserve product-adjacent tests

Vitest tests below `apps/*/src` and `packages/*/src` remain when they directly verify a product module, domain invariant, adapter, API, or UI behavior. Database-backed tests colocated with API modules remain independently runnable.

Alternative: delete every test. Rejected because it would remove direct product evidence rather than the separate platform that caused the delay.

### 3. Different quality regimes by role

Maintained product source keeps strict file/function/complexity limits, immutability ratchets, import boundaries, and canonical role-chain enforcement. Tests and fixtures keep formatting, type safety, and failure-prevention rules but no structural, complexity, immutability, or preference-style budgets.

### 4. No replacement orchestration

No smoke, catalog, checklist, generated scenario tree, custom reporter, receipt, budget gate, wrapper, or browser CI job replaces the deleted tree. A concrete product defect may receive a focused colocated regression test.

## Before / After Flow

```text
Before
product -> unit tests + separate E2E/UAT/catalog/acceptance platform

After
product source -> colocated focused tests -> ordinary code gates
```

## Risks / Trade-offs

- [No cross-role browser smoke] -> Verify concrete behavior in the owning product module and perform human product review when warranted.
- [A browser-only regression can escape] -> Add a focused product-adjacent regression only after a demonstrated defect or requirement.
- [Test helpers grow again] -> Keep helpers local to their product test family; no root test platform.
- [Playwright dependency is removed too broadly] -> Retain `apps/api`'s production `playwright` dependency for PDF rendering.

## Migration Plan

1. Delete root E2E/UAT source and dependencies.
2. Remove package scripts, CI jobs, lint/config gates, ownership data, suppressions, and documentation references.
3. Reconcile durable OpenSpec requirements that named the retired harness.
4. Run formatting, product typecheck/lint/unit tests, build, strict OpenSpec validation, and a clean diff review.

Rollback is a normal Git revert and does not authorize any retired campaign.
