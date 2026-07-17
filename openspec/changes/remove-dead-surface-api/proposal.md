## Why

A confirmed code-review sweep of `apps/api` found nine dead-surface findings across otel, pdf-export, period, report-sections, weekly-report, and the tRPC middleware layer: exports, interface methods, and one canonical procedure builder that no production code calls, kept alive only by their own unit tests (or, for `pdfExportRouter`, a test that imports a stale module instead of the real router). One finding is worse than dead: the doc comment on `getReportMeta` claims the service "falls back to `getReportStatus`" when `getReportMeta` is unimplemented, but `evaluateDeadlineGate` just returns `false` — the comment misdescribes actual control flow and exists only to justify keeping `getReportStatus` around. Dead code with live tests reads as covered, load-bearing surface to future readers; it is neither.

## What Changes

- Delete `shutdownOtel` from `otel.bootstrap.ts` — `startOtel` already registers its own `SIGTERM`/`SIGINT` shutdown handlers inline; this was a duplicated, uncalled shutdown surface.
- Delete the `apps/api/src/modules/pdf-export/pdf-export.router.ts` module (`pdfExportRouter`, `PdfExportRouterRequestContext`, `PdfExportRouterStatusContext`) and repoint `pdf-export.service.test.ts` at the real router (`apps/api/src/infrastructure/trpc/routers/pdf-export.router.ts`) or its own service contract, whichever the test actually needs.
- Delete `applyTransition` and `runTransition` from `period-transition.apply.ts` — every real transition writer (`publish`/`reopen`/`archive`/`autoArchive`/`create`) calls `buildTransition` directly inside its own transaction; neither wrapper has a production caller. Remove the file if nothing remains, or fold what's left into its test-only status.
- Delete `getReportStatus` from `ReportSectionsRepository` (interface, Prisma adapter, all test stubs) and correct the `getReportMeta` doc comment to describe the real fallback (`evaluateDeadlineGate` returns `false`, no late-flag computed) instead of a fallback that does not exist.
- Delete `getLatestPublishedId` from `WeeklyReportRepository` (interface, `WeeklyReportPrismaRepository` impl, the underlying `queryLatestPublishedId` query) and all test stubs — `getLatestPublishedNonArchivedId` is the one production callers use.
- Delete `leadHeadAdminProcedure` and its backing `leadHeadAdminRoleMiddleware` from `trpc.middleware.ts` — no procedure is built on it; update `role-coverage-gate`'s spec and allow-list from 9 to 8 canonical builders.
- Repo-wide grep each deleted symbol before removal to confirm zero remaining production callers; delete or rewrite each symbol's own now-pointless unit tests.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `architecture-refactor-backlog`: records this dead-surface removal pass as a completed backlog entry.

## Impact

- API: `apps/api/src/infrastructure/otel/otel.bootstrap.ts`; `apps/api/src/modules/pdf-export/` (router module + service test); `apps/api/src/modules/period/application/period-transition.apply.ts` (+ its unit/integration tests); `apps/api/src/modules/report-sections/application/report-sections.service.ts` and its Prisma adapter + test stubs; `apps/api/src/modules/weekly-report/weekly-report.service.ts`, `weekly-report.prisma-repository.ts`, `report-lifecycle-ids.prisma-query.ts`, and their tests; `apps/api/src/infrastructure/trpc/trpc.middleware.ts` + `trpc.middleware.test.ts` + `__tests__/role-coverage.test.ts`.
- Docs: `openspec/specs/role-coverage-gate/spec.md` wording and allow-list, 9 builders → 8.
- No schema change, no web change, no runtime behavior change — every deletion target is provably caller-free before removal.

## Non-goals

- Touching `startOtel`'s inline shutdown handlers, `buildTransition`, `getReportPeriodStatusForSection`, `getLatestPublishedNonArchivedId`, or any of the 8 surviving canonical procedure builders.
- Changing the `leadershipProcedure` pdfExport policy (head + admin + viewer) — lead stays forbidden from that surface, unrelated to this cleanup.
