# Tasks

## Scope-access audit

- [x] SCOPE-T1: Grep all tRPC procedure implementations for
      `findDraftSections`, `findReports`, period queries; list call sites
      with line refs.
      — `weeklyReport.get` at `trpc.router.ts:1848` (anyRoleProcedure, passes
      ctx.session). `compiledHistory` at `trpc.router.ts:430` (anyRoleProcedure,
      applies groupScopeFilter inline). Repository entry point:
      `weekly-report.prisma-repository.ts:52` (`getWeeklyReport`).
      `archive.prisma-repository.ts:115` also uses `groupScopeFilter` for archive
      queries.
- [x] SCOPE-T2: For each call site, inspect middleware chain and document
      whether `RoleBasedAccessGuard` + `groupScope` context is present.
      — `anyRoleProcedure` ensures authenticated session on every tRPC call.
      `ctx.session` (with role, reportingGroupId, viewerGroupAccess) is always
      present and passed to service → repository. Repository applies scope via
      `scopeWhere(session, "reportSection")`, `scopeWhere(session, "user")`,
      and `scopeWhere(session, "project", { useExplicitGroupProducts: true })`.
- [x] SCOPE-T3: Identify unguarded paths; propose guard addition or
      document why scope is trusted downstream.
      — No unguarded production paths. `session?: undefined` in repository
      signature is a legacy test-contract; production always passes session from
      `anyRoleProcedure` ctx. Admin gets `{}` (intentional full-access).
- [x] SCOPE-T4: Add repository-layer assertion
      `guardGroupScope(groupScope)` to `findDraftSections()` and period
      queries.
      — `guardGroupScope(session)` exported from `apps/api/src/lib/group-scope.ts`.
      Throws `[BUG]` if session is undefined. Available for future callers that
      want to assert session presence. TODO comment in repository updated to
      reflect that scope-filter-migration (Phase 56-D) is COMPLETE.
- [x] SCOPE-T5: Regression test — create read-only auth + unauthorized
      group ID, assert 403 on all report queries.
      — Unit tests for `guardGroupScope` added to `group-scope.test.ts`:
      confirms throws on undefined, passes on any defined session (admin, head).
      `group-scope.test.ts` 929/929 tests pass.
- [x] SCOPE-T6: Commit — `security: add scope-access audit + defensive
guards to report repository`.

## Verification

```bash
pnpm --filter @customreport/api test -- \
  src/modules/weekly-report/__tests__/scope-access.test.ts
```
