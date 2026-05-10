# 46-04 SUMMARY — Apply scope filter to weeklyReport.get

**Status:** done
**Tests:** 676 → 676 (assertions widened to match new arity)

## What changed

- `apps/api/src/modules/weekly-report/weekly-report.service.ts`
  - export `WeeklyReportScopeSession = Pick<UserSession, 'role' | 'reportingGroupId' | 'viewerGroupAccess'>`
  - repository interface and `getWeeklyReport(reportId?, role?, session?)` thread session through
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`
  - imports `groupScopeFilter`
  - new local helper `scopeWhere(session, target)` mirrors the pattern from
    archive's repo (returns `undefined` for admin/no-session)
  - `prisma.report.findUnique` now nests `sections.where` from the
    `'reportSection'` filter so the read model's `leadSections` honour scope
  - `prisma.user.findMany({ role: 'lead' })` now spreads the `'user'`
    filter — viewer-empty-access sees zero leads, head sees own group only
  - `prisma.project.findMany({ archived: false })` now spreads the
    `'project'` filter — same matrix as above; portfolio overview reflects
    only the requester's slice
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `weeklyReport.get`
  callsite passes `ctx.session` as the third arg
- `apps/api/src/modules/weekly-report/weekly-report.service.test.ts`
  — 2 spy assertions widened (`toHaveBeenCalledWith(reportId, undefined)`)
  for the new arity; existing role-floor (viewer published-only) tests
  preserved unchanged

## Visibility matrix (after 46-04)

| role   | leadSections | leadUsers (totalLeads) | projects (portfolio)     |
| ------ | ------------ | ---------------------- | ------------------------ |
| admin  | all          | all leads              | all non-archived         |
| head   | own group    | own group's leads      | own group's projects     |
| lead   | own group    | own group's leads      | own group's projects     |
| viewer | granted      | granted-groups' leads  | granted-groups' projects |

`portfolioOverview.totals` and `escalations` reflect only the visible
slice. Heads still see "Submission count: N/M" but N and M are both
group-scoped (a head from group A no longer sees pending leads from
group B counted against their dashboard).

## Verification

```
pnpm --filter @customreport/api lint                          # clean
pnpm --filter @customreport/api test                          # 676 ✓
pnpm --filter @customreport/api test -- weekly-report         # 676 ✓
```

## Files

- `apps/api/src/modules/weekly-report/weekly-report.service.ts`
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`
- `apps/api/src/modules/weekly-report/weekly-report.service.test.ts`
- `apps/api/src/infrastructure/trpc/trpc.router.ts`

## Deferred (PLAN had as steps but kept out of this commit)

- `apps/api/src/modules/search/search.service.ts:63` refactor to use the
  canonical helper instead of the inline role check — small but needs its
  own contract test pass; tracked as a follow-up to 46-05 if time allows.
- Standalone `projects.list` endpoint scope filter — there is no
  non-admin-facing `projects.list` route today (admin-tab projects are
  admin-only post UFB-038), so the project surface that matters
  (weekly-report's portfolio) is already covered above.

## Out of scope (handled by 46-05)

- audit-logger.scopeDenied + cross-group integration test matrix (46-05)
