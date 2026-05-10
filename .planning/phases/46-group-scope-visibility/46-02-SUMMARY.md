# 46-02 SUMMARY — Apply scope filter to review dashboard

**Status:** done
**Tests:** 674 → 676 (+2 new spy-repo cases for session pass-through)

## What changed

- `apps/api/src/modules/review/review.service.ts` — `getSubmissionDashboard`
  now requires a second `session: DashboardScopeSession` argument
  (`Pick<UserSession, 'role' | 'reportingGroupId' | 'viewerGroupAccess'>`).
  Repository interface updated to match.
- `apps/api/src/modules/review/review.prisma-repository.ts` — Prisma
  `findMany` spreads `groupScopeFilter(session, 'reportSection')` into
  the where fragment. admin → no extra filter; head/lead → only sections
  whose author is in the requester's group; viewer → only sections whose
  author is in any of the granted groups; viewer with empty access → 0
  rows.
- `apps/api/src/modules/review/review.router.ts` — passes `ctx.session`
  to the service.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `dashboard:`
  procedure callsite passes `ctx.session`.
- Tests:
  - `review.service.test.ts` — existing tests updated to new signature;
    +2 spy-repo cases proving the session reaches the repository, including
    viewer-with-empty-access (`viewerGroupAccess: []`).
  - `review.contract.test.ts` — repo mock signature widened, all 11
    `service.getSubmissionDashboard(reportId)` calls now pass
    `ADMIN_SESSION` so the unit-level sorting/parsing contracts stay
    independent of the scope axis.
  - `review.integration.test.ts` — repo callsites pass `{ role: 'admin' }`
    so the end-to-end Prisma path keeps existing semantics for admin.

## Verification

```
pnpm --filter @customreport/api lint                # clean
pnpm --filter @customreport/api test                # 676 ✓
pnpm --filter @customreport/api test -- review      # 676 ✓ (10 review-suite files)
```

## Files

- `apps/api/src/modules/review/review.service.ts`
- `apps/api/src/modules/review/review.prisma-repository.ts`
- `apps/api/src/modules/review/review.router.ts`
- `apps/api/src/modules/review/review.service.test.ts`
- `apps/api/src/modules/review/review.contract.test.ts`
- `apps/api/src/modules/review/review.integration.test.ts`
- `apps/api/src/infrastructure/trpc/trpc.router.ts`

## Out of scope (handled by 46-03..46-05)

- archive.list / archive.detail wiring (46-03)
- weeklyReport.get section filtering (46-04)
- audit-logger.scopeDenied + cross-group integration test matrix (46-05)
