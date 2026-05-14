---
phase: 28-role-filters-pdf-cookie-seam-deadline-reminders-release-chec
plan: 01
type: summary
status: complete
requirements: [AUTH-04]
commit: c3881378c582744d4379be3790f2636772cfbbd0
---

# 28-01 SUMMARY — service-layer role filters for archive + review (AUTH-04)

## Procedure migration table

| Surface                  | Before               | After              |
| ------------------------ | -------------------- | ------------------ |
| `archive.list`           | `protectedProcedure` | `anyRoleProcedure` |
| `archive.detail`         | `protectedProcedure` | `anyRoleProcedure` |
| `review.dashboard`       | `protectedProcedure` | `headProcedure`    |
| `weeklyReport.get`       | `protectedProcedure` | `anyRoleProcedure` |
| `review.assembledReport` | `headProcedure`      | unchanged          |
| `review.publish`         | `headProcedure`      | unchanged          |

## anyRoleProcedure addition

Added per plan Task 3a — required for the read-with-server-side-filter pattern. Exported from `apps/api/src/infrastructure/trpc/trpc.middleware.ts` and recognised by the AUTH-03 default-deny coverage gate (`role-coverage.test.ts` extended with `ANY_ROLE_CHAIN`).

## Service-layer filter shape

Service layer now translates `Role` → an `ArchiveReadFilter` plain object the repository merges into its Prisma `where`. Type kept Prisma-free (only enumerates `'draft' | 'published'`, mirroring the Prisma `ReportStatus` enum).

- `ArchiveService.listArchiveReports(pagination?, role?)` — viewer → `{status:'published'}`, otherwise `{}`.
- `ArchiveService.getArchiveReport(reportId, role?)` — same filter passed through.
- `WeeklyReportService.getWeeklyReport(reportId?, role?)` — viewer + `periodStatus !== 'published'` throws `WeeklyReportDomainError` (matches the existing not-found contract).

## Defense-in-depth

Repository's hardcoded `status: 'published'` floor preserved in `archive.prisma-repository.ts` (named `PUBLISHED_FLOOR`). Service-layer filter is composed on top so a future caller that mis-builds the filter cannot widen visibility beyond what the repository already enforces. `findUnique` in `getArchiveReport` was migrated to `findFirst` because Prisma's `WhereUniqueInput` rejects non-unique fields once `status` is composed in.

## Test count delta

- Baseline: 401 unit tests (30 files).
- After 28-01: 412 unit tests (30 files).
- Delta: +11 tests.
  - +6 in `archive.service.test.ts` ("AUTH-04 viewer scoping" describe block).
  - +5 in `weekly-report.service.test.ts` ("AUTH-04 viewer scoping" describe block).

## Files changed

- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — exports `anyRoleProcedure`.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — migrates archive.\* → anyRoleProcedure, review.dashboard → headProcedure, weeklyReport.get → anyRoleProcedure; threads `ctx.session.role`.
- `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts` — adds `ANY_ROLE_CHAIN` to allowed prefixes.
- `apps/api/src/modules/archive/archive.service.ts` — `Role`-aware service signature, `buildArchiveReadFilter` helper, `ArchiveReadFilter` type.
- `apps/api/src/modules/archive/archive.prisma-repository.ts` — repository accepts optional `ArchiveReadFilter`, merges on top of `PUBLISHED_FLOOR`. `findUnique` → `findFirst`.
- `apps/api/src/modules/archive/archive.router.ts` — wrapper threads `role` into service calls.
- `apps/api/src/modules/archive/archive.service.test.ts` — adds 6 viewer-scoping tests.
- `apps/api/src/modules/weekly-report/weekly-report.service.ts` — `Role`-aware `getWeeklyReport`.
- `apps/api/src/modules/weekly-report/weekly-report.service.test.ts` — adds 5 viewer-scoping tests.

## Deviations from the plan

1. **`undefined` role is NOT fail-closed.** The plan's prose suggested fail-closed for unknown role, but the existing contract / unit tests in `weekly-report.service.test.ts` exercise the pre-AUTH-04 zero-arg signature where role is implicitly absent. Per the plan's own escape hatch ("If existing tests break … prefer adding the optional `role` param so old callers default to 'no filter'"), `undefined` is treated as "no scoping" — legacy behaviour preserved. The router always threads `ctx.session.role`, so a real viewer session in production cannot reach the undefined branch.

2. **Repository signature widening, not behavioural change for non-viewers.** The plan envisioned heads/leads seeing drafts via archive when role-passed `{}`. Existing integration tests assert "archive returns only published reports" regardless of caller. Kept the repository's hardcoded floor (`PUBLISHED_FLOOR`) as defense-in-depth so behaviour for non-viewers is unchanged today; the service-layer filter is purely additive narrowing. Phase 29's frontend `<RoleGate>` work can later expose drafts to heads through a different surface if/when product wants it.

3. **`archive.router.ts` was edited** even though it was not in the plan's explicit `files_modified` list — the wrapper's signature had to thread `role` into the service call, otherwise typescript breaks.

## Verification gates run

- `pnpm --filter @customreport/api typecheck` — exit 0.
- `pnpm --filter @customreport/api test` — 412/412 passed (was 401).
- `npx eslint` over touched files — 0 errors (only pre-existing `no-non-null-assertion` warnings, none introduced).
- Integration canary (`archive.integration.test.ts` + `review.integration.test.ts` + `weekly-report.integration.test.ts`) — 10/10 passed against `customreport_e2e` Postgres.
- AUTH-03 default-deny gate (`role-coverage.test.ts`) — green; recognises `anyRoleProcedure`.
