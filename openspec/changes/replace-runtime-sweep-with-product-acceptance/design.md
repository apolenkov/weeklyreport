## Context

See `proposal.md` for motivation. The current browser surface is split between useful focused suites (`e2e/integration`, `e2e/sweep`, seed profiles, production-build/CSP) and an 859-file, ~141,620-line runtime platform. Forty-six files outside that platform mention `runtime-sweep`; most are historical OpenSpec records, while the live dependencies are package commands, structural gates, two sweep helpers, product-variant tooling, one health test, docs, and four active changes.

The replacement must preserve the exact disposable-database guard, per-run consent, role-coverage gate, period dual-state invariant, and existing product behavior. It changes no request path, Prisma write, shared schema, credential, or production runtime.

## Goals / Non-Goals

**Goals:**

- Delete the exhaustive runtime platform instead of refactoring it again.
- Produce release-relevant WeeklyReport feedback in at most 30 minutes.
- Keep the browser denominator explicit: catalog route health plus one representative cross-role smoke lifecycle.
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

### 2. One Playwright config, two smoke-sized projects

`e2e/acceptance/playwright.config.ts` owns:

- `route-health`: the four-role catalog walk with console, page-error, request-failure, HTTP, and axe checks;
- `smoke-lifecycle`: one deterministic lead write -> head publish -> viewer read lifecycle, including basic role landing and authorization checks.

`test:acceptance:smoke` selects only the representative lifecycle. `test:acceptance` runs route health plus that lifecycle serially against one reset seed. `test:uat` is the route-health subset. No separate full journey matrix exists.

Alternative: chain multiple existing configs. Rejected because it fragments timing, reports, setup, and cleanup. Alternative: duplicate every integration test. Rejected because browser acceptance owns only the representative smoke; the full integration suite remains independently owned.

### 3. External disposable services, Playwright-owned app processes

Acceptance requires an already provisioned loopback PostgreSQL/Redis E2E target from the developer or CI service layer. It never creates or deletes containers or volumes. Global setup validates `E2E_DATABASE_URL`, proves it differs from `DATABASE_URL`, applies the existing destructive guard and per-run consent, resets/migrates/seeds once, and records the starting SHA. Playwright `webServer` owns API/web processes and ports; global teardown closes test clients and proves those ports have no run-owned listeners.

Alternative: a Docker/shell supervisor. Rejected because it recreates custom orchestration and interruption edge cases. CI already owns service lifecycle; local onboarding already defines the disposable database boundary.

### 4. Product assertions over interaction enumeration

The smoke lifecycle owns one observable product outcome with server/database read-back. The browser denominator is:

| Surface | Smoke outcome                                                       |
| ------- | ------------------------------------------------------------------- |
| lead    | authenticate, open report, make one representative write, submit    |
| head    | authenticate, observe the submitted state, publish                  |
| viewer  | authenticate, observe the published value read-only                 |
| admin   | authenticate and reach the canonical landing surface                |
| shared  | catalog route health, console/network/page errors, axe, role guards |

PDF, revoke, configuration, action-log, detailed role authorization, ordering, and other edge cases remain owned by existing focused unit/integration/product-build suites. The smoke spec may reuse public integration fixtures and helpers but does not import test internals across suites.

Alternative: compile catalog prose into tests. Rejected because the catalog is an intent/route contract, not a second BDD language.

### 5. Standard evidence and simple SHA binding

The Playwright reporter emits list plus HTML and JSON/JUnit output. Failure artifacts use built-in trace, screenshot, and video retention. A small reporter attachment records Git SHA/tree, browser version, command kind, duration, totals, and cleanup status. There are no hash chains, append-only ledgers, per-action assets, or partial-run promotion.

Alternative: preserve immutable campaign manifests. Rejected because Git, CI logs, standard reports, and archived release summaries already supply the necessary identity at far lower complexity.

### 6. Whole-contour budgets are an active gate

A repository gate counts every non-generated file and line below `e2e/acceptance/`, measures smoke/combined/teardown durations from Playwright results, and fails above 25 files, 4,000 lines, 10 minutes, 15 minutes, or 2 minutes. A planted fixture proves the structural counter fails. Duration is reported on every run; CI enforces it with a small platform allowance only if explicitly specified in the durable contract.

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
Git SHA -> guarded reset/seed -> route health + one smoke lifecycle
        -> standard Playwright report/failure artifacts -> bounded cleanup result
```

No WeeklyReport request, tRPC, or Prisma production data flow changes.

## Risks / Trade-offs

- [Loss of theoretical interaction coverage] → Preserve catalog route census, one representative lifecycle, focused regression tests, and manual/advisory exploration; document that browser acceptance is smoke-only, not exhaustive.
- [Deleting a generic helper with the platform] → Inventory every live external import and rewrite only proven shared helpers before deletion; require zero live runtime-sweep references.
- [Smoke state interference] → Run one worker, reset once, give the lifecycle deterministic owned records, and clean mutations through focused fixtures.
- [External service residue is confused with runner residue] → Record service ownership explicitly; the runner cleans only its app processes/temp files and never claims ownership of developer/CI service containers.
- [Duration varies by machine] → Enforce the reference-Mac ceiling locally and a documented CI allowance only through an explicit spec amendment; never silently raise timeouts.
- [Historical OpenSpec claims become misleading] → Preserve archives unchanged, mark active runtime-dependent tasks superseded, and update durable specs plus current owner plan in the same migration.

## Migration Plan

1. Mark r6 `NOT_RUN_SUPERSEDED_BY_OWNER_DIRECTION`; preserve the packet only as historical planning evidence.
2. Add the new acceptance config, reporter metadata, budget gate, and planted structural/duration tests without importing runtime-sweep code.
3. Rewrite the two live sweep/product-variant helper dependencies into focused shared E2E helpers and prove behavior with focused tests.
4. Rewrite or retire every live runtime-sweep consumer, then delete `e2e/runtime-sweep/`, its package commands/config entries/gate inventory, and coupled product-variant tooling. Historical archived text remains immutable.
5. Rename and limit the second Playwright project to one smoke lifecycle; retain route health as the only broader browser census.
6. Run route health and smoke against the exact guarded E2E database after deletion, then obtain independent architecture review.
7. Reconcile `establish-exhaustive-runtime-sweep`, `stabilize-report-record-ordering`, `reorganize-repository-tooling-boundaries`, and `harden-preproduction-sdlc-controls` as superseded or satisfied by the new acceptance contract without falsely checking unexecuted old tasks.
8. Run deterministic gates, focused existing E2E suites, smoke acceptance, cleanup interruption probes, strict OpenSpec validation, and a clean exact-SHA read-back.

Rollback is a normal Git revert of the replacement commits. It restores source code but does not authorize replay of any historical runtime campaign; a rollback must still use a fresh exact-source acceptance decision.
