---
phase: 16-backend-hardening
plan: 02
subsystem: infra
tags: [bullmq, nestjs, health-check, docker, dependency-injection]

# Dependency graph
requires:
  - phase: 14-backend-hardening-containerization
    provides: BullMQModule, processors, Docker Compose configuration
provides:
  - BullMQModule wired into AppModule for queue connectivity
  - PdfExportService receives real Queue instance via DI (not null)
  - RemindersService receives real Queue instance via DI (not null)
  - BullMQ health indicator in readiness endpoint
  - Clean .dockerignore excluding agent/screenshot artifacts
affects: [16-backend-hardening, 18-e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: [getQueueToken factory injection for BullMQ queues in NestJS modules, @InjectQueue decorator for health indicators]

key-files:
  created:
    - apps/api/src/infrastructure/health/bullmq.health.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/modules/pdf-export/pdf-export.module.ts
    - apps/api/src/modules/reminders/reminders.module.ts
    - apps/api/src/infrastructure/health/health.module.ts
    - apps/api/src/infrastructure/health/health.controller.ts
    - .dockerignore

key-decisions:
  - "Each module importing BullMQModule directly (NestJS module-scoped DI requires explicit import per consumer)"
  - "Docker Compose ports already correct at 3001 -- plan stale snapshot, skipped redundant edits"

patterns-established:
  - "getQueueToken factory pattern: inject BullMQ queue into services via useFactory + getQueueToken"
  - "@InjectQueue decorator for health indicators that need queue access"

requirements-completed: [BE-02]

# Metrics
duration: 4min
completed: 2026-04-21
---

# Phase 16 Plan 02: BullMQ Queue Wiring Summary

**Re-enabled BullMQ queue infrastructure with DI wiring into AppModule, PdfExportModule, RemindersModule, plus readiness health indicator for queue connectivity**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T16:47:52Z
- **Completed:** 2026-04-21T16:52:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- BullMQModule imported in AppModule so queues connect to Redis on startup
- PdfExportService and RemindersService receive real Queue instances via getQueueToken DI (no longer silently skipping enqueue)
- BullMQHealthIndicator added to readiness endpoint checking both pdf-export and email-reminder queue connectivity
- .dockerignore extended to exclude .claude/, .graphifyignore, and *.png artifacts

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire BullMQ into AppModule and inject queues into service modules** - `83326ec` (feat)
2. **Task 2: Add BullMQ health indicator and fix Docker Compose port mismatch** - `2349e71` (feat)

## Files Created/Modified
- `apps/api/src/app.module.ts` - Added BullMQModule import to AppModule
- `apps/api/src/modules/pdf-export/pdf-export.module.ts` - Imports BullMQModule, injects pdf-export queue via getQueueToken
- `apps/api/src/modules/reminders/reminders.module.ts` - Imports BullMQModule, injects email-reminder queue via getQueueToken
- `apps/api/src/infrastructure/health/bullmq.health.ts` - New BullMQHealthIndicator with @InjectQueue for both queues
- `apps/api/src/infrastructure/health/health.module.ts` - Added BullMQModule import and BullMQHealthIndicator provider
- `apps/api/src/infrastructure/health/health.controller.ts` - Added bullmq health check to readiness endpoint
- `.dockerignore` - Added .claude/, .graphifyignore, *.png exclusions

## Decisions Made
- Each module imports BullMQModule directly because NestJS DI is module-scoped -- a queue token registered in AppModule is not automatically available in child modules
- Docker Compose ports were already correct at 3001 (plan was based on stale snapshot) -- skipped redundant edits to avoid introducing errors
- Used .js extension in health module imports to match existing convention in that directory

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docker Compose port edits skipped -- already correct**
- **Found during:** Task 2 (Docker Compose port mismatch fix)
- **Issue:** Plan specified changing 3002 to 3001, but docker-compose.yml already has 3001:3001 and localhost:3001
- **Fix:** Verified current state is correct, skipped redundant edits
- **Files modified:** None (no change needed)
- **Verification:** grep confirms 3001:3001 and localhost:3001 in docker-compose.yml

---

**Total deviations:** 1 (skipped unnecessary edit)
**Impact on plan:** No impact -- the intended end state was already in place.

## Issues Encountered
- Pre-existing typecheck errors in test files (admin.integration.test.ts, reminders.integration.test.ts) -- unrelated to this plan's changes, no action taken

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BullMQ queues are fully wired and will connect to Redis on startup
- Health readiness endpoint now validates queue connectivity
- Ready for remaining backend hardening tasks (plans 03-04)
- BullMQ re-enablement unblocks PDF/email E2E testing in Phase 18

---
*Phase: 16-backend-hardening*
*Completed: 2026-04-21*
