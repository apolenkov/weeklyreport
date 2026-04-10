---
phase: 05-backend-foundation
plan: 02
subsystem: api
tags: [nestjs, zod, prisma, repository-pattern, dependency-injection, env-validation]

requires:
  - phase: 05-01
    provides: PrismaService singleton, PrismaModule, complete schema with 14 models

provides:
  - NestJS AppModule root wiring PrismaModule and 4 domain modules
  - Zod-based environment validation schema (DATABASE_URL, PORT, AUTH_DEV_MODE, etc.)
  - ReviewPrismaRepository with submission dashboard query
  - ArchivePrismaRepository with published report list and detail views
  - PdfExportPrismaRepository with job CRUD and assembled report query
  - RemindersPrismaRepository with rule/execution CRUD and deduplication via upsert

affects: [05-03, 05-04, 05-05]

tech-stack:
  added: []
  patterns: ["NestJS useFactory DI pattern for repository-to-service wiring", "toDomain mapper functions for Prisma-to-Zod shape transformation", "Status code mapping tables (domain <-> DB enum values)", "fullReportInclude shared constant for deep Prisma includes"]

key-files:
  created:
    - apps/api/src/infrastructure/config/env.schema.ts
    - apps/api/src/modules/review/review.prisma-repository.ts
    - apps/api/src/modules/review/review.module.ts
    - apps/api/src/modules/archive/archive.prisma-repository.ts
    - apps/api/src/modules/archive/archive.module.ts
    - apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts
    - apps/api/src/modules/pdf-export/pdf-export.module.ts
    - apps/api/src/modules/reminders/reminders.prisma-repository.ts
    - apps/api/src/modules/reminders/reminders.module.ts
  modified:
    - apps/api/src/app.module.ts

key-decisions:
  - "useFactory DI pattern -- NestJS modules wire repositories to services via useFactory+inject rather than custom DI tokens"
  - "Status mapping tables -- domain enum values (queued/sent) differ from DB enum values (pending/sent), explicit mapping tables handle conversion"
  - "fullReportInclude as shared constant -- deep Prisma include for assembled reports reused across archive and pdf-export repositories"
  - "eslint-disable for toSectionReadModel -- complex nested mappers use any casts with explicit eslint-disable blocks rather than typing every Prisma result shape"

patterns-established:
  - "Pattern: NestJS module per domain -- each module provides+exports its service, injects repository via useFactory"
  - "Pattern: toDomain mappers -- private functions transform Prisma query results to Zod schema shapes"
  - "Pattern: Status enum mapping -- Record<string, string> tables for bidirectional domain <-> DB status conversion"
  - "Pattern: computePortfolioOverview -- shared helper aggregates traffic light statuses across sections"

requirements-completed: [API-01, API-04, API-05, REPO-02, REPO-04, REPO-05, REPO-08]

duration: 5min
completed: 2026-04-10
---

# Phase 5 Plan 02: NestJS AppModule, Env Config & 4 Prisma Repositories Summary

**NestJS root module with Zod env validation plus 4 Prisma repository implementations (review, archive, pdf-export, reminders) using useFactory DI pattern and toDomain mappers**

## Performance

- **Duration:** 5 min (verification and summary creation; code was committed by parallel agent)
- **Started:** 2026-04-10T16:50:12Z
- **Completed:** 2026-04-10T16:51:18Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- NestJS AppModule wires PrismaModule and 4 domain modules (review, archive, pdf-export, reminders) with placeholder comment for Plan 03 modules
- Zod environment validation schema validates DATABASE_URL, PORT, NODE_ENV, AUTH_DEV_MODE, LOG_LEVEL, and FRONTEND_URL with sensible defaults and fail-fast on invalid config
- 4 Prisma repository implementations with full toDomain mappers transforming DB shapes to Zod schema shapes
- 4 NestJS domain modules using consistent useFactory pattern to inject repositories into existing service classes
- TypeScript compiles clean across the API app (after Prisma client generation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create env validation schema and NestJS AppModule** - `d984f32` (feat)
2. **Task 2: Implement Review, Archive, PdfExport, and Reminders Prisma repositories + NestJS modules** - `22120d1` (feat)

## Files Created/Modified

- `apps/api/src/infrastructure/config/env.schema.ts` - Zod schema validating DATABASE_URL, PORT, NODE_ENV, FRONTEND_URL, AUTH_DEV_MODE, LOG_LEVEL, LOG_DIR
- `apps/api/src/app.module.ts` - Root NestJS module importing PrismaModule + 4 domain modules
- `apps/api/src/modules/review/review.prisma-repository.ts` - ReviewPrismaRepository with getSubmissionDashboard query (includes author + led projects)
- `apps/api/src/modules/review/review.module.ts` - ReviewModule wiring ReviewPrismaRepository to ReviewService
- `apps/api/src/modules/archive/archive.prisma-repository.ts` - ArchivePrismaRepository with listArchiveReports and getArchiveReport (full deep include)
- `apps/api/src/modules/archive/archive.module.ts` - ArchiveModule wiring ArchivePrismaRepository to ArchiveService
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` - PdfExportPrismaRepository with job CRUD and getPublishedReport (full deep include)
- `apps/api/src/modules/pdf-export/pdf-export.module.ts` - PdfExportModule wiring PdfExportPrismaRepository to PdfExportService
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts` - RemindersPrismaRepository with rule lookup, execution upsert deduplication, and list by rule
- `apps/api/src/modules/reminders/reminders.module.ts` - RemindersModule wiring RemindersPrismaRepository to RemindersService

## Decisions Made

1. **useFactory DI pattern** -- Each NestJS module registers the repository as a provider and wires it to the service via `useFactory: (repo) => new XService(repo)` with `inject: [XPrismaRepository]`. This preserves the existing service constructor signature while leveraging NestJS DI.
2. **Status enum mapping tables** -- Domain uses `queued`/`sent` while DB uses `pending`/`sent`. Explicit `Record<string, string>` mapping tables (`pdfStatusToDb`, `dbStatusToDomain`, `execStatusToDb`, `dbExecStatusToDomain`) handle bidirectional conversion.
3. **Shared fullReportInclude constant** -- Both ArchivePrismaRepository and PdfExportPrismaRepository need the same deep include for assembled reports. Each defines its own `fullReportInclude` constant (not shared across modules to avoid coupling).
4. **eslint-disable for complex mappers** -- The `toSectionReadModel` and `toAssembledReport` functions in archive and pdf-export use `any` casts with explicit eslint-disable blocks because typing every nested Prisma result shape would add significant boilerplate for read-only mapping functions.

## Deviations from Plan

None - plan executed exactly as written. All 10 files match the plan's acceptance criteria.

## Issues Encountered

None.

## Known Stubs

None -- all repositories implement every method defined in their service interfaces.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 4 simpler repositories are complete and wired -- Plan 05-03 can now implement the 4 complex repositories (report-sections, publication, carry-over, admin)
- AppModule has placeholder comment for Plan 03 modules -- executor will add imports when modules are created
- The useFactory DI pattern and toDomain mapper pattern are established as conventions for Plan 03 to follow
- **Critical for 05-03:** The `fullReportInclude` pattern shows how to handle deep nested queries; report-sections repository will need similar deep includes with transactions

## Self-Check: PASSED

- All 10 created files exist on disk
- Both task commits (d984f32, 22120d1) found in git history
- SUMMARY.md created at expected path

---
*Phase: 05-backend-foundation*
*Completed: 2026-04-10*
