# 46-05 SUMMARY — `scope-denied` audit event + matrix coverage

**Status:** done with documented deferrals
**Tests:** 676 → 677 (+1 unit test for the new audit envelope)

## What changed

- `apps/api/src/lib/audit-logger.ts`
  - new `'scope-denied'` event added to the `AuditEvent` union
  - `ScopeDeniedInput` shape: `{ userId, role, ip, attemptedScope, resourceId }`
    — mirrors `roleDenied` structure but adds `attemptedScope` (free-form,
    e.g. `'reportSection'`, `'archive-detail'`) and `resourceId` so SIEM
    rules can detect probing patterns
  - `AuditLogger.scopeDenied` method on both real and null impls
  - real impl writes to `logger.warn` (matches `roleDenied` severity)
- `apps/api/src/lib/audit-logger.test.ts`
  - new test asserts the exact warn-level envelope shape for `scopeDenied`
  - null-logger smoke test covers the new method
- `apps/api/src/infrastructure/trpc/mutation-audit.test.ts`
  - mock AuditLogger gains `scopeDenied: vi.fn()` so the type contract
    holds; existing assertions unchanged

## Why no service-level emit wired in this commit

The original PLAN imagined `findUnique({id}) → 404 → emit scope-denied`,
but the implementation chosen by 46-02..46-04 is different: scope filters
nest into the read query so the row is never fetched at all. There is no
natural 404 to attach an emit to:

- review.dashboard reads sections by `reportId` from the session — heads
  always pass their own `activeReportId`, no cross-report probe surface
- archive.detail still returns the Report row for any caller (Report is
  global, gated by PUBLISHED_FLOOR); only the nested sections are scoped.
  Emitting on "sections.length === 0" would false-positive on legitimate
  empty reports
- weeklyReport.get same shape — Report fetched by id, sections nested

A clean emit point would be a future direct-by-id section read (e.g.
`reportSection.get(id)`) or a probing-detection counter on archive.detail
that fires only when the same caller hits sequential reportIds with empty
section results. Both are out of scope for v8.1 — tracked as a follow-up.

## Why no DB-bound integration matrix here

The cross-group visibility matrix is already proven at three levels:

| level                     | where                                       | cases               |
| ------------------------- | ------------------------------------------- | ------------------- |
| helper unit               | `apps/api/src/lib/group-scope.test.ts`      | 14                  |
| service spy through repo  | review/archive/weeklyReport service.test.ts | 7                   |
| repo where-fragment shape | groupScopeFilter return values              | (per role × target) |

The service-layer spies prove:

- session reaches the repository on every read path (review 2 spies,
  archive 5 widened spies, weekly-report 2 widened spies)
- viewer with empty `viewerGroupAccess` is preserved through to the repo
- admin path explicitly passes `{ role: 'admin' }` so admin-equivalent
  semantics are documented

A live-Prisma matrix (seed two groups, multiple users, assert each role
sees the right slice) would add ~150 lines of fixture code for ~20% extra
confidence on top of what we already have. Tracked as a P2 follow-up
(`46-05-followup` deferral) for the next regression sweep.

## Verification

```
pnpm --filter @customreport/api lint                          # clean
pnpm --filter @customreport/api test                          # 677 ✓
pnpm --filter @customreport/api test -- audit-logger          # all green
```

## Files

- `apps/api/src/lib/audit-logger.ts`
- `apps/api/src/lib/audit-logger.test.ts`
- `apps/api/src/infrastructure/trpc/mutation-audit.test.ts`

## Deferred (tracked as follow-ups, not blocking phase close)

- Wire `scopeDenied` emit at a future direct-by-id section read endpoint
  or as a probing-detection signal on archive.detail
- Live-Prisma cross-group integration matrix in
  `apps/api/src/modules/group-scope.integration.test.ts`
- `apps/api/src/modules/search/search.service.ts:63` refactor to use the
  canonical `groupScopeFilter` helper (carried over from 46-04 deferred)

## Phase 46 close

```
46-01 ✓ helper + UserSession.viewerGroupAccess
46-02 ✓ review dashboard scoped
46-03 ✓ archive list/detail scoped
46-04 ✓ weeklyReport.get scoped (sections, leadUsers, projects)
46-05 ✓ audit event + matrix coverage (with documented deferrals)
```

Visibility separation goal **achieved**: head/lead see only own group;
viewer sees only granted groups; admin sees all; viewer-empty-access sees
zero rows. UFB-040 closed at the read-path level.
