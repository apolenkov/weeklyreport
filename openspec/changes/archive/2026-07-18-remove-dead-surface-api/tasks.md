# Tasks

## 1. Reachability proof (do first, abort any item that fails)

- [ ] 1.1 Repo-wide grep `shutdownOtel`, `applyTransition`, `runTransition`, `getReportStatus`, `getLatestPublishedId`, `leadHeadAdminProcedure`, `leadHeadAdminRoleMiddleware`, `pdfExportRouter` — confirm every hit is a declaration, its own test, or (for `pdfExportRouter`) the stale test import; abort deletion of any symbol with a real production caller
- [ ] 1.2 Read `evaluateDeadlineGate` in `report-sections.service.ts` and confirm it returns `false` directly with no `getReportStatus` call, so the doc-comment claim on `getReportMeta` is provably false before rewriting it

## 2. otel

- [ ] 2.1 Delete `shutdownOtel` from `otel.bootstrap.ts`; keep the inline `SIGTERM`/`SIGINT` handlers `startOtel` already registers

## 3. pdf-export

- [ ] 3.1 Delete `apps/api/src/modules/pdf-export/pdf-export.router.ts` (`pdfExportRouter`, `PdfExportRouterRequestContext`, `PdfExportRouterStatusContext`)
- [ ] 3.2 Update `pdf-export.service.test.ts` to stop importing the deleted module; test against `PdfExportService` directly or the real router at `infrastructure/trpc/routers/pdf-export.router.ts`

## 4. period-transition

- [ ] 4.1 Delete `applyTransition` and `runTransition` from `period-transition.apply.ts`; delete the file if nothing remains
- [ ] 4.2 Delete `period-transition.apply.test.ts` and the `period-transition.integration.test.ts` cases that exist only to cover these two functions; confirm every live publish/reopen/archive/autoArchive/create writer already calls `buildTransition` directly

## 5. report-sections

- [ ] 5.1 Delete `getReportStatus` from the `ReportSectionsRepository` interface, the Prisma adapter (`report-sections.prisma-repository.ts`), and every in-memory test-stub repo (`report-sections.service.test.ts`, `report-sections.contract.test.ts`, `report-sections.published-lock.test.ts`, `report-sections.activity-status.test.ts`)
- [ ] 5.2 Rewrite the `getReportMeta` doc comment to state the real fallback: when `getReportMeta` is not implemented, `evaluateDeadlineGate` returns `false` and no late flag is computed — remove the false "falls back to `getReportStatus`" claim

## 6. weekly-report

- [ ] 6.1 Delete `getLatestPublishedId` from the `WeeklyReportRepository` interface, `WeeklyReportPrismaRepository`, and the underlying `queryLatestPublishedId` query in `report-lifecycle-ids.prisma-query.ts`
- [ ] 6.2 Update every test stub/reference (`weekly-report.contract.test.ts`, `weekly-report.integration.test.ts`, `weekly-report.latest-published-non-archived.integration.test.ts`, `weekly-report.service.test.ts`, `weekly-report.prisma-repository.test.ts`, `period.service.test.ts`) to drop the method and its assertions; keep `getLatestPublishedNonArchivedId` untouched

## 7. role-coverage builder

- [ ] 7.1 Delete `leadHeadAdminProcedure` and `leadHeadAdminRoleMiddleware` from `trpc.middleware.ts`
- [ ] 7.2 Update `trpc.middleware.test.ts` and `infrastructure/trpc/__tests__/role-coverage.test.ts` to drop the removed builder from the allow-list and its coverage assertions
- [ ] 7.3 Update `openspec/specs/role-coverage-gate/spec.md`: change every "9 canonical builders" wording and the enumerated list to 8, removing `leadHeadAdminProcedure`

## Gates

- [ ] `pnpm --filter @customreport/api db:generate`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm --filter @customreport/api test:integration`
