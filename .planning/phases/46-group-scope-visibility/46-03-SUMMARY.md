# 46-03 SUMMARY — Apply scope filter to archive list / detail

**Status:** done
**Tests:** 676 → 676 (assertions widened to match new arity, no new behaviour
test on top of 46-01's matrix)

## What changed

- `apps/api/src/modules/archive/archive.service.ts`
  - `ArchiveScopeSession = Pick<UserSession, 'role' | 'reportingGroupId' | 'viewerGroupAccess'>` exported
  - `ArchiveRepository.listArchiveReports(filter?, session?)` and
    `getArchiveReport(reportId, filter?, session?)` — both accept optional
    session (legacy callers without session keep working; admin-equivalent)
  - `ArchiveService.listArchiveReports(pagination?, role?, session?)` and
    `getArchiveReport(reportId, role?, session?)` thread session through
- `apps/api/src/modules/archive/archive.prisma-repository.ts`
  - imports `groupScopeFilter`
  - new helper `sectionScopeWhere(session)` → returns Prisma where fragment
    or `undefined` for admin / no-session paths
  - `prisma.report.findMany` now nests `sections.where` from
    `groupScopeFilter(session, 'reportSection')` so non-admin callers see
    only sections whose author is in their allowed groups
  - `findFirst` for detail does the same; the Report row itself stays
    globally visible (still gated by PUBLISHED_FLOOR + ArchiveReadFilter)
- `apps/api/src/modules/archive/archive.router.ts` — Context types gain
  optional `session?: ArchiveScopeSession`; both router methods forward it
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `archive.list` and
  `archive.detail` callsites pass `ctx.session` as the third arg
- `apps/api/src/modules/archive/archive.service.test.ts` — existing 5 spy
  assertions widened to expect the new third arg (`undefined` when service
  is called without an explicit session, mirroring legacy admin path)

## Visibility matrix (after 46-03)

| role   | sees in archive.list | sees in archive.detail.sections |
| ------ | -------------------- | ------------------------------- |
| admin  | all published        | all sections                    |
| head   | all published        | only own group's sections       |
| lead   | all published        | only own group's sections       |
| viewer | all published        | only granted-groups' sections   |

Report rows remain globally visible (still gated by PUBLISHED_FLOOR) so
period browsing is unaffected; per-report section count and assembled view
are now scoped.

## Verification

```
pnpm --filter @customreport/api lint                # clean
pnpm --filter @customreport/api test                # 676 ✓
pnpm --filter @customreport/api test -- archive     # 676 ✓
```

## Files

- `apps/api/src/modules/archive/archive.service.ts`
- `apps/api/src/modules/archive/archive.prisma-repository.ts`
- `apps/api/src/modules/archive/archive.router.ts`
- `apps/api/src/modules/archive/archive.service.test.ts`
- `apps/api/src/infrastructure/trpc/trpc.router.ts`

## Out of scope (handled by 46-04..46-05)

- weeklyReport.get section filtering (46-04)
- audit-logger.scopeDenied + cross-group integration test matrix (46-05)
- portfolio-overview totals reflect only the requester's slice (intended);
  consider exposing a separate `globalPortfolio` field if business asks for
  the un-scoped roll-up (deferred, not in scope here)
