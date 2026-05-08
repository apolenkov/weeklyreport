---
phase: 05-backend-foundation
plan: 05
subsystem: api
tags: [vitest, integration-tests, prisma, postgresql, qa]

requires:
  - phase: 05-02
    provides: "4 simple Prisma repositories (review, archive, pdf-export, reminders)"
  - phase: 05-03
    provides: "4 complex Prisma repositories (report-sections, publication, carry-over, admin)"

provides:
  - "Prisma test helper with Prisma 7 driver adapter pattern and FK-safe cleanup"
  - "17 integration tests covering read/write paths for all 8 Prisma repositories"
  - "test:integration script for running integration tests against real PostgreSQL"
  - "QA-01 verified: all 39 existing unit tests pass unchanged"
  - "QA-04 verified: all repositories tested against real PostgreSQL"

affects: []

tech-stack:
  added: []
  patterns:
    - "Prisma 7 driver adapter (PrismaPg + pg.Pool) in test helper matching PrismaService"
    - "Sequential integration test execution (--fileParallelism=false) for shared DB isolation"
    - "RFC4122 UUID v4 test fixtures (TEST_IDS constant) for Zod schema compliance"
    - "Repository instantiation with PrismaClient as never for structural typing"

key-files:
  created:
    - apps/api/src/test-utils/prisma-test-helper.ts
    - apps/api/src/modules/report-sections/report-sections.integration.test.ts
    - apps/api/src/modules/review/review.integration.test.ts
    - apps/api/src/modules/publication/publication.integration.test.ts
    - apps/api/src/modules/admin/admin.integration.test.ts
    - apps/api/src/modules/archive/archive.integration.test.ts
    - apps/api/src/modules/carry-over/carry-over.integration.test.ts
    - apps/api/src/modules/pdf-export/pdf-export.integration.test.ts
    - apps/api/src/modules/reminders/reminders.integration.test.ts
  modified:
    - apps/api/package.json

key-decisions:
  - "Prisma 7 adapter pattern in test helper -- test PrismaClient uses same PrismaPg + pg.Pool pattern as production PrismaService for fidelity"
  - "Sequential file execution -- integration tests share a database so --fileParallelism=false prevents race conditions between test files"
  - "Valid UUID v4 fixtures -- Zod schemas enforce RFC4122 UUID format so test IDs must have version digit [1-8] at position 13 and variant [89ab] at position 17"
  - "Direct repository instantiation -- tests bypass NestJS DI and instantiate repos directly with PrismaClient, testing repository logic in isolation from framework"

patterns-established:
  - "Pattern: TEST_IDS constant -- centralized valid UUID v4 fixtures exported from test helper for all integration tests"
  - "Pattern: cleanDatabase function -- FK-safe deletion of all 14 tables in reverse dependency order"
  - "Pattern: seedTestData function -- minimal but complete test fixture (head, lead, project, report, section)"

requirements-completed: [QA-01, QA-04]

duration: 15min
completed: 2026-04-10
---

# Phase 5 Plan 05: Integration Tests for Prisma Repositories Summary

**17 integration tests verifying all 8 Prisma repository implementations against real PostgreSQL, plus validation that all 39 existing unit tests pass unchanged**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-10T16:59:10Z
- **Completed:** 2026-04-10T17:13:47Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- All 39 existing unit tests pass unchanged (QA-01 verified)
- Test helper created with Prisma 7 driver adapter pattern (PrismaPg + pg.Pool) matching production PrismaService
- 8 integration test files with 17 tests covering read and write paths for every repository
- ReportSectionsPrismaRepository: 3 tests (full nested read, null return, transactional save with 5 nested entity types)
- ReviewPrismaRepository: 2 tests (dashboard rows, empty result)
- PublicationPrismaRepository: 2 tests (assembled report read, publish status write)
- AdminPrismaRepository: 2 tests (snapshot read with 5 tables, snapshot upsert write)
- ArchivePrismaRepository: 2 tests (published-only filter, full detail read)
- CarryOverPrismaRepository: 2 tests (null dedupeKey lookup, atomic transactional save with records and items)
- PdfExportPrismaRepository: 2 tests (job creation, status update with filePath)
- RemindersPrismaRepository: 2 tests (upsert deduplication, ordered list)
- test:integration script added to package.json for CI usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify existing unit tests pass and create test helper** - `a9854e7` (feat)
2. **Task 2: Write integration tests for all 8 Prisma repositories** - `887203a` (test)

## Files Created/Modified

- `apps/api/src/test-utils/prisma-test-helper.ts` - Test utility with createTestPrisma, cleanDatabase, seedTestData, disconnectTestPrisma, TEST_IDS
- `apps/api/src/modules/report-sections/report-sections.integration.test.ts` - 3 integration tests
- `apps/api/src/modules/review/review.integration.test.ts` - 2 integration tests
- `apps/api/src/modules/publication/publication.integration.test.ts` - 2 integration tests
- `apps/api/src/modules/admin/admin.integration.test.ts` - 2 integration tests
- `apps/api/src/modules/archive/archive.integration.test.ts` - 2 integration tests
- `apps/api/src/modules/carry-over/carry-over.integration.test.ts` - 2 integration tests
- `apps/api/src/modules/pdf-export/pdf-export.integration.test.ts` - 2 integration tests
- `apps/api/src/modules/reminders/reminders.integration.test.ts` - 2 integration tests
- `apps/api/package.json` - Added test:integration script

## Decisions Made

1. **Prisma 7 adapter pattern in test helper**: The test PrismaClient uses the exact same `PrismaPg(pool)` adapter initialization as the production `PrismaService`, ensuring integration tests exercise the same connection path. This is critical because Prisma 7 dropped `datasourceUrl` in favor of driver adapters.

2. **Sequential file execution**: Database integration tests share a single PostgreSQL database. Running test files in parallel causes unique constraint violations when `seedTestData` creates fixed-ID records concurrently. `--fileParallelism=false` ensures test files run one at a time while tests within a file still run sequentially via `beforeEach` cleanup.

3. **RFC4122 UUID v4 fixtures (TEST_IDS)**: Initial test data used `00000000-0000-0000-0000-000000000001` which fails Zod UUID validation (requires version digit `[1-8]` at position 13 and variant `[89ab]` at position 17). Fixed to `a0000000-0000-4000-a000-...` format which passes strict UUID validation.

4. **Direct repository instantiation**: Tests instantiate repository classes directly with `new XPrismaRepository(prisma as never)` rather than bootstrapping NestJS. This tests repository SQL logic in isolation from framework DI, matching the existing unit test pattern of constructor injection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid UUID test fixtures**

- **Found during:** Task 2
- **Issue:** Plan-specified UUIDs `00000000-0000-0000-0000-000000000001` fail Zod strict UUID v4 validation (version and variant digits don't match RFC4122)
- **Fix:** Created TEST_IDS constant with `a0000000-0000-4000-a000-...` format that passes UUID validation
- **Files modified:** apps/api/src/test-utils/prisma-test-helper.ts, all 8 integration test files
- **Commit:** 887203a

**2. [Rule 3 - Blocking] Created test database and ran migrations**

- **Found during:** Task 2
- **Issue:** Test database `customreport_test` did not exist; integration tests cannot run without it
- **Fix:** Created database via pg.Pool query to postgres admin DB, then ran `prisma migrate deploy`
- **Files modified:** None (runtime database setup only)

**3. [Rule 1 - Bug] Fixed parallel test file execution race condition**

- **Found during:** Task 2
- **Issue:** Vitest runs test files in parallel by default; shared database with fixed seed IDs causes unique constraint violations when multiple test files seed simultaneously
- **Fix:** Added `--fileParallelism=false` to test:integration script
- **Files modified:** apps/api/package.json
- **Commit:** 887203a

**4. [Rule 1 - Bug] Corrected test count: 39 tests not 51**

- **Found during:** Task 1
- **Issue:** Plan states "51 existing unit tests" but actual count is 39 tests across 9 test files
- **Fix:** Documented correct count (39) in summary; no code changes needed
- **Files modified:** None

## Known Stubs

None -- all integration tests exercise real repository methods against real PostgreSQL.

## User Setup Required

Integration tests require a running PostgreSQL with the `customreport_test` database:

```bash
# Start PostgreSQL (e.g., via Docker or local install)
# Create test database
node -e "const pg=require('pg');const p=new pg.Pool({connectionString:'postgresql://postgres:postgres@localhost:5432/postgres'});p.query('CREATE DATABASE customreport_test').then(()=>{console.log('created');p.end()}).catch(e=>{console.log(e.code==='42P04'?'exists':e.message);p.end()})"
# Run migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customreport_test pnpm exec prisma migrate deploy
# Run integration tests
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customreport_test pnpm --filter=@customreport/api run test:integration
```

## Self-Check: PASSED

- All 10 created/modified files exist on disk
- Task commit a9854e7 found in git history
- Task commit 887203a found in git history
- 17 integration tests verified passing against real PostgreSQL
- 39 unit tests verified still passing

---

_Phase: 05-backend-foundation_
_Completed: 2026-04-10_
