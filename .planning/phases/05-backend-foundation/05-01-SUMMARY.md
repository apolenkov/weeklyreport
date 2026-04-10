---
phase: 05-backend-foundation
plan: 01
subsystem: database
tags: [prisma, postgresql, nestjs, seed, migration, adapter-pg]

requires:
  - phase: none
    provides: Initial codebase with Prisma schema (9 models) and seed script

provides:
  - Complete Prisma schema with 14 domain models and 9 enums
  - Initial PostgreSQL migration creating all tables
  - Idempotent seed script (8 users, projects, report period)
  - PrismaService global singleton with pg adapter for NestJS DI

affects: [05-02, 05-03, 05-04, 05-05]

tech-stack:
  added: ["@prisma/adapter-pg", "pg", "@types/pg"]
  patterns: ["Prisma 7 driver adapter pattern", "PrismaService extends PrismaClient with pool lifecycle", "Deterministic seed IDs for idempotency"]

key-files:
  created:
    - prisma/migrations/20260410150628_init/migration.sql
    - apps/api/src/infrastructure/prisma/prisma.service.ts
    - apps/api/src/infrastructure/prisma/prisma.module.ts
  modified:
    - prisma/schema.prisma
    - prisma/seed.ts
    - prisma.config.ts
    - package.json

key-decisions:
  - "Prisma 7 requires driver adapter (@prisma/adapter-pg + pg.Pool) instead of datasourceUrl in PrismaClient constructor"
  - "datasource url/directUrl moved to prisma.config.ts (Prisma 7 breaking change from Prisma 6)"
  - "Seed command configured in prisma.config.ts migrations.seed (not package.json prisma.seed)"
  - "14 models total (not 15 as plan stated) -- original schema had 9 models, not 10"

patterns-established:
  - "Pattern: PrismaService with pg.Pool adapter -- all future PrismaClient usage must use adapter constructor"
  - "Pattern: Deterministic seed IDs (00000000-0000-0000-0000-...) for idempotent upserts"
  - "Pattern: type-only imports for NestJS interfaces (verbatimModuleSyntax)"

requirements-completed: [DB-01, DB-02, DB-03, DB-04]

duration: 13min
completed: 2026-04-10
---

# Phase 5 Plan 01: Prisma Schema, Migration, Seed & PrismaService Summary

**Complete Prisma schema with 14 models, initial PostgreSQL migration, idempotent seed (8 users), and PrismaService singleton using Prisma 7 driver adapter pattern**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-10T15:02:40Z
- **Completed:** 2026-04-10T15:16:02Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Complete Prisma schema with all 14 domain models (9 existing + 5 new: PdfExportJob, ReminderRule, ReminderExecution, CarryOverExecution, CarryOverRecord) and 9 enums
- Initial migration creates all tables in PostgreSQL without errors
- Idempotent seed script creates 8 users (6 leads + 1 head + 1 viewer), 6 projects, 1 report period -- runs twice cleanly
- PrismaService global singleton ready for injection into all repository implementations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 5 missing Prisma models and run initial migration** - `4525aef` (feat)
2. **Task 2: Fix seed script for idempotency and add viewer user** - `b49e98d` (feat)
3. **Task 3: Create PrismaService singleton and PrismaModule** - `4debfd9` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - Complete schema with 14 models, 9 enums, 5 new models added
- `prisma/migrations/20260410150628_init/migration.sql` - Initial migration creating all tables
- `prisma/seed.ts` - Idempotent seed with deterministic IDs, viewer user, pg adapter
- `prisma.config.ts` - Added directUrl for PgBouncer-safe migrations, seed command config
- `package.json` - Added @prisma/adapter-pg, pg, @types/pg dependencies
- `apps/api/src/infrastructure/prisma/prisma.service.ts` - PrismaClient singleton with pg.Pool adapter
- `apps/api/src/infrastructure/prisma/prisma.module.ts` - @Global() NestJS module exporting PrismaService

## Decisions Made

1. **Prisma 7 driver adapter pattern** -- Prisma 7 removed `datasourceUrl` and `datasources` from PrismaClient constructor. Must use `@prisma/adapter-pg` with `pg.Pool`. This affects all PrismaClient instantiation (seed, PrismaService, tests).
2. **URL config in prisma.config.ts** -- Prisma 7 moved `url` and `directUrl` from `schema.prisma` datasource block to `prisma.config.ts`. The schema only declares the provider.
3. **Seed config location** -- Prisma 7 reads seed command from `prisma.config.ts` `migrations.seed` field, not from `package.json` `prisma.seed`.
4. **14 models (not 15)** -- The plan stated "10 existing + 5 new = 15 models" but the actual existing count was 9 models. The final schema has 14 models, which is all domain models required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma 7 API breaking changes**
- **Found during:** Task 1 and Task 2
- **Issue:** Plan specified `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")` in schema.prisma. Prisma 7.6.0 rejects these with error P1012 -- datasource properties url/directUrl are no longer supported in schema files.
- **Fix:** Moved url and directUrl to prisma.config.ts datasource block. Schema keeps only `provider = "postgresql"`.
- **Files modified:** prisma/schema.prisma, prisma.config.ts
- **Verification:** `pnpm exec prisma validate` passes
- **Committed in:** 4525aef (Task 1 commit)

**2. [Rule 3 - Blocking] PrismaClient constructor requires adapter in Prisma 7**
- **Found during:** Task 2 (seed script) and Task 3 (PrismaService)
- **Issue:** `new PrismaClient()` with no args or with `datasourceUrl`/`datasources` throws PrismaClientInitializationError. Prisma 7 "client" engine requires either `adapter` or `accelerateUrl`.
- **Fix:** Installed `@prisma/adapter-pg` + `pg`. Both seed.ts and PrismaService use `new PrismaPg(pool)` adapter pattern.
- **Files modified:** prisma/seed.ts, apps/api/src/infrastructure/prisma/prisma.service.ts, package.json
- **Verification:** Seed runs twice without errors; TypeScript compiles cleanly
- **Committed in:** b49e98d (Task 2), 4debfd9 (Task 3)

**3. [Rule 1 - Bug] Model count in plan was incorrect**
- **Found during:** Task 1
- **Issue:** Plan stated "current 10 models" and "15 models total". Actual count was 9 existing models, making the total 14.
- **Fix:** Documented correct count. All domain models from the data model are present.
- **Impact:** None -- all required models exist.

---

**Total deviations:** 3 auto-fixed (2 blocking Prisma 7 API changes, 1 incorrect count)
**Impact on plan:** All auto-fixes necessary due to Prisma 7 breaking changes from Prisma 6 API. No scope creep. The driver adapter pattern is the correct Prisma 7 architecture.

## Issues Encountered

- PostgreSQL Docker container needed to be started manually (no docker-compose.yml exists yet -- deferred to Phase 7)
- pnpm was not available in PATH; installed globally via `npm install -g pnpm@9.15.0`

## Known Stubs

None -- all code is fully wired and functional.

## User Setup Required

None - no external service configuration required. PostgreSQL runs via Docker (`docker run -d --name customreport-postgres ...`).

## Next Phase Readiness

- PrismaService is ready for injection into all 8 repository implementations (Plan 05-02, 05-03)
- Schema is complete and migration applied -- repositories can immediately start querying
- Seed data available for integration testing
- **Critical for downstream:** All PrismaClient instantiation must use the adapter pattern (`new PrismaPg(pool)`)

---
*Phase: 05-backend-foundation*
*Completed: 2026-04-10*
