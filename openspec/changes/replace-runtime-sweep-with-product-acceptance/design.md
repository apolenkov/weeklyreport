## Context

See `proposal.md` for motivation. The current browser surface is split between useful focused suites (`e2e/integration`, `e2e/sweep`, seed profiles, production-build/CSP) and an 859-file, ~141,620-line runtime platform. Forty-six files outside that platform mention `runtime-sweep`; most are historical OpenSpec records, while the live dependencies are package commands, structural gates, two sweep helpers, product-variant tooling, one health test, docs, and four active changes.

The replacement must preserve the exact disposable-database guard, per-run consent, role-coverage gate, period dual-state invariant, and existing product behavior. It changes no request path, Prisma write, shared schema, credential, or production runtime.

## Goals / Non-Goals

**Goals:**

- Delete the exhaustive runtime platform instead of refactoring it again.
- Produce release-relevant WeeklyReport feedback in at most 30 minutes.
- Keep the browser denominator explicit: catalog route health plus named critical journeys for four roles.
- Make ordinary Playwright output, exact SHA, and cleanup read-back sufficient evidence.
- Keep the replacement small enough for one engineer to understand and change.

**Non-Goals:**

- Proving every reachable DOM interaction or pairwise state combination.
- Creating containers, observability stacks, resumable campaigns, or AI review pipelines inside the test runner.
- Replacing focused Vitest/integration/product-build tests.
- Starting any owner-deferred mobile change.

## Decisions

### 1. Clean-room contour; no runtime-sweep code migration

`e2e/acceptance/` is authored from product outcomes, the route catalog, and existing focused integration contracts. No module from `e2e/runtime-sweep/` is copied into it. A genuinely generic helper used by non-runtime code is rewritten behind `e2e/helpers/` with focused tests; the old implementation is only a behavioral reference.

Alternative: shrink the existing platform in place. Rejected because its source authority, graph, continuation, matrix, lane, evidence, and AI contracts are mutually coupled; retaining any as the root preserves the architecture that caused the problem.

### 2. One Playwright config, two bounded projects

`e2e/acceptance/playwright.config.ts` owns:

- `route-health`: the four-role catalog walk with console, page-error, request-failure, HTTP, and axe checks;
- `critical-journeys`: deterministic lead, head, admin, viewer, cross-role lifecycle, and PDF journeys.

`test:acceptance:smoke` selects one representative write/read flow plus route-health; `test:acceptance` runs both projects serially against one reset seed. `test:uat` becomes a compatibility alias during migration and is then documented as the route-health subset.

Alternative: chain multiple existing configs. Rejected because it fragments timing, reports, setup, and cleanup. Alternative: duplicate every integration test. Rejected because acceptance names only release-critical journeys; the full integration suite remains independently owned.

### 3. External disposable services, Playwright-owned app processes

Acceptance requires an already provisioned loopback PostgreSQL/Redis E2E target from the developer or CI service layer. It never creates or deletes containers or volumes. Global setup validates `E2E_DATABASE_URL`, proves it differs from `DATABASE_URL`, applies the existing destructive guard and per-run consent, resets/migrates/seeds once, and records the starting SHA. Playwright `webServer` owns API/web processes and ports; global teardown closes test clients and proves those ports have no run-owned listeners.

Alternative: a Docker/shell supervisor. Rejected because it recreates custom orchestration and interruption edge cases. CI already owns service lifecycle; local onboarding already defines the disposable database boundary.

### 4. Product assertions over interaction enumeration

Each critical journey owns an observable product outcome and, for mutations, a server/database read-back. The minimum denominator is:

| Role/surface | Critical outcome                                                    |
| ------------ | ------------------------------------------------------------------- |
| lead         | edit/autosave, deterministic record order, submit/locked state      |
| head         | review, publish, revoke, downstream visibility, PDF export          |
| admin        | period/configuration write, action-log search/detail, authorization |
| viewer       | published report navigation, read-only enforcement, PDF download    |
| shared       | catalog route health, console/network/page errors, axe, role guards |

The role specs may reuse public integration fixtures and helpers but do not import test internals across suites.

Alternative: compile catalog prose into tests. Rejected because the catalog is an intent/route contract, not a second BDD language.

### 5. Standard evidence and simple SHA binding

The Playwright reporter emits list plus HTML and JSON/JUnit output. Failure artifacts use built-in trace, screenshot, and video retention. A small reporter attachment records Git SHA/tree, browser version, command kind, duration, totals, and cleanup status. There are no hash chains, append-only ledgers, per-action assets, or partial-run promotion.

Alternative: preserve immutable campaign manifests. Rejected because Git, CI logs, standard reports, and archived release summaries already supply the necessary identity at far lower complexity.

### 6. Whole-contour budgets are an active gate

A repository gate counts every non-generated file and line below `e2e/acceptance/`, measures smoke/full/teardown durations from Playwright results, and fails above 50 files, 8,000 lines, 10 minutes, 30 minutes, or 2 minutes. A planted fixture proves the structural counter fails. Duration is reported on every run; CI enforces it with a small platform allowance only if explicitly specified in the durable contract.

Alternative: per-directory limits. Rejected because nested directories can hide overall growth, as happened in the retired platform.

### 7. AI review is optional product review

Native model or human browser review may produce candidates against standard artifacts, but cannot write the deterministic report or gate result. Confirmed findings become ordinary focused tests/fixes.

Alternative: provider report import. Rejected because it adds a second schema and authority path without making deterministic coverage stronger.

## Before / After Flow

```text
Before
Git SHA -> SOURCE -> preflight graph -> continuation/checkpoints -> matrix/lanes
        -> custom evidence ledger -> AI import/adjudication -> campaign verdict

After
Git SHA -> guarded reset/seed -> route health + critical journeys
        -> standard Playwright report/failure artifacts -> bounded cleanup result
```

No WeeklyReport request, tRPC, or Prisma production data flow changes.

## Risks / Trade-offs

- [Loss of theoretical interaction coverage] → Preserve catalog route census, critical outcomes, focused regression tests, and manual/advisory exploration; document that acceptance is bounded, not exhaustive.
- [Deleting a generic helper with the platform] → Inventory every live external import and rewrite only proven shared helpers before deletion; require zero live runtime-sweep references.
- [Critical journey state interference] → Run one worker, reset once, give each journey deterministic owned records, and clean mutations through focused fixtures.
- [External service residue is confused with runner residue] → Record service ownership explicitly; the runner cleans only its app processes/temp files and never claims ownership of developer/CI service containers.
- [Duration varies by machine] → Enforce the reference-Mac ceiling locally and a documented CI allowance only through an explicit spec amendment; never silently raise timeouts.
- [Historical OpenSpec claims become misleading] → Preserve archives unchanged, mark active runtime-dependent tasks superseded, and update durable specs plus current owner plan in the same migration.

## Migration Plan

1. Mark r6 `NOT_RUN_SUPERSEDED_BY_OWNER_DIRECTION`; preserve the packet only as historical planning evidence.
2. Add the new acceptance config, reporter metadata, budget gate, and planted structural/duration tests without importing runtime-sweep code.
3. Rewrite the two live sweep/product-variant helper dependencies into focused shared E2E helpers and prove behavior with focused tests.
4. Implement route-health and the named critical journeys; run smoke and full acceptance against the exact guarded E2E database.
5. Compare the new denominator against the useful existing integration/UAT coverage, add only missing product outcomes, and obtain independent architecture review.
6. Delete `e2e/runtime-sweep/`, its package commands/config entries/gate inventory, and all live references in one green structural commit. Historical archived text remains immutable.
7. Reconcile `establish-exhaustive-runtime-sweep`, `stabilize-report-record-ordering`, `reorganize-repository-tooling-boundaries`, and `harden-preproduction-sdlc-controls` as superseded or satisfied by the new acceptance contract without falsely checking unexecuted old tasks.
8. Run all deterministic gates, smoke/full acceptance, cleanup interruption probes, strict OpenSpec validation, and a clean exact-SHA read-back.

Rollback is a normal Git revert of the replacement commits. It restores source code but does not authorize replay of any historical runtime campaign; a rollback must still use a fresh exact-source acceptance decision.
