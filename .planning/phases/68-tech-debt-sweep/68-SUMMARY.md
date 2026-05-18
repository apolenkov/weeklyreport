---
phase: 68
title: Tech Debt Sweep (TD-01..TD-06)
status: passed
milestone: v8.2
completed: 2026-05-18
---

# Phase 68 — Tech Debt Sweep

## Goal

Close TD-01..TD-06 accumulated in the v8.1 milestone audit. Each item was deferred at the time with a concrete follow-up contract; this phase delivers on every item.

## Deliverables

### TD-01 — `scopeDenied` audit event wired (Phase 46 audit emit)

`apps/api/src/infrastructure/trpc/trpc.router.ts`: `ctx.auditLogger.scopeDenied()` emitted before `throw new TRPCError(FORBIDDEN)` in the `search.query` handler's `SearchAuthorizationError` catch block. `resourceId` carries the search query string so SIEM rules can detect cross-scope probing patterns.

Commit: `b1859ba fix(api): TD-01 — emit scopeDenied on SearchAuthorizationError in search path`

### TD-02 — Cross-group Prisma integration test matrix

`apps/api/src/modules/group-scope.integration.test.ts`: 8 integration tests with real Prisma covering the cross-group visibility matrix (head-A/head-B isolation, admin full-access, viewer with/without grants, viewer with partial grants).

Commit: `test(api): TD-02 — cross-group Prisma integration matrix`

### TD-03 — `groupScopeFilter` helper in SearchService

`apps/api/src/modules/search/search.service.ts`: refactored session parameter from `{ userId, role }` to full `UserSession`; added `groupIds` derivation logic (admin=null, head/lead=[reportingGroupId], viewer=[viewerGroupAccess], empty-array → early return without repo call).

`apps/api/src/modules/search/search.prisma-repository.ts`: added `sectionGroupFilter` and `projectGroupFilter` SQL fragments (subquery approach) applied to all 4 UNION chunks.

`apps/api/src/infrastructure/trpc/trpc.router.ts`: simplified call site — pass `ctx.session` directly instead of destructured `{ userId, role }`.

`apps/api/src/modules/search/search.service.test.ts`: added `UserSession` shape + 5 new TD-03 tests covering all role × groupIds combinations.

Commit: `feat(api): TD-03 — group-scope filter in SearchService + SearchPrismaRepository`

### TD-04 — Playwright spec for ReminderPolicy admin editor

`apps/web/e2e/admin-reminder-policy.spec.ts`: 7 E2E tests (SC-P44-01..SC-P44-07) using `adminPage` fixture. Covers policy list, New Policy form, form fields, save→list, edit pre-fill, expand details, delete dialog.

`apps/web/e2e/regression/admin-reminder-policy.spec.ts`: 6 regression tests using `loginByCookie(admin)` helper matching existing regression spec pattern.

`apps/web/e2e/fixtures.ts`: added `adminPage: Page` fixture loading `admin.json` storage state.

Commit: `test(web): TD-04 — ReminderPolicy admin editor E2E + regression specs`

### TD-05 — PolicyApplicator fan-out performance test

`apps/api/src/modules/reminders/policy-applicator.perf.test.ts`: 5 vitest unit tests with Prisma stubs.

- 10 policies < 50 ms, 50 policies < 200 ms (O(N²) regression guard)
- valid-from/until window filtering skips policies without DB writes
- `updated` counter increments correctly for existing rules
- `findUnique + upsert` called exactly once per policy

All 5 pass: 5/5.

Commit: `test(api): TD-05 — PolicyApplicatorService fan-out performance`

### TD-06 — PolicyApplicator wired into PeriodCreatorScheduler

`apps/api/src/modules/period/period-creator.scheduler.ts`: injected optional `PolicyApplicatorService`; calls `await this.policyApplicator?.applyToPeriod(created)` immediately after `prisma.report.create()`.

`apps/api/src/modules/period/period.module.ts`: added `PolicyApplicatorService` as direct provider; updated scheduler factory to inject it.

Commit: `feat(api): TD-06 — inject PolicyApplicatorService into PeriodCreatorScheduler`

## Verification

```
pnpm typecheck          # 0 errors
pnpm lint               # 0 errors
pnpm test               # all pass (TD-02 integration + TD-03 unit + TD-05 perf included)
```

## Status

`passed` — all 6 tech debt items closed with commits and tests.
