---
phase: 07-production-infrastructure
plan: 01
subsystem: infra
tags: [bullmq, redis, nodemailer, playwright, pdf, email, bull-board, nestjs]

requires:
  - phase: 05-backend-foundation
    provides: "NestJS DI container, PdfExportService, RemindersService, Prisma repositories"
  - phase: 06-auth-frontend-integration
    provides: "tRPC router with head/protected procedures, AppModule structure"
provides:
  - "BullMQ module with Redis connection and 2 queues (pdf-export, email-reminder)"
  - "PDF export processor generating PDFs via Playwright with SHA-256 checksum"
  - "Email reminder processor sending SMTP via nodemailer"
  - "Bull Board monitoring UI at /admin/queues"
  - "EmailService injectable wrapping nodemailer with dev/prod modes"
  - "Graceful shutdown hooks enabled"
affects: [07-02-health-metrics, 07-03-docker-compose]

tech-stack:
  added:
    [
      playwright,
      "@nestjs/bullmq",
      bullmq,
      "@bull-board/api",
      "@bull-board/express",
      nodemailer,
    ]
  patterns:
    [
      "BullMQ WorkerHost processor pattern",
      "Queue injection via getQueueToken + useFactory DI",
      "Non-blocking email with jsonTransport dev fallback",
    ]

key-files:
  created:
    - apps/api/src/infrastructure/bullmq/bullmq.module.ts
    - apps/api/src/infrastructure/bullmq/pdf-export.processor.ts
    - apps/api/src/infrastructure/bullmq/email-reminder.processor.ts
    - apps/api/src/infrastructure/bullmq/bull-board.module.ts
    - apps/api/src/infrastructure/email/email.service.ts
  modified:
    - apps/api/src/infrastructure/config/env.schema.ts
    - apps/api/src/modules/pdf-export/pdf-export.service.ts
    - apps/api/src/modules/pdf-export/pdf-export.module.ts
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - .env.example
    - apps/api/package.json

key-decisions:
  - "Queue injection via optional constructor parameter preserves domain service testability"
  - "EmailService uses jsonTransport dev fallback when SMTP_HOST is absent"
  - "Bull Board mounted as Express middleware (auth to be layered via JWT middleware later)"

patterns-established:
  - "WorkerHost processor: extend WorkerHost, decorate with @Processor, implement process()"
  - "Queue DI pattern: getQueueToken('name') in useFactory inject array"
  - "Dev email fallback: jsonTransport logs to stdout instead of sending"

requirements-completed: [JOBS-01, JOBS-02, JOBS-03, JOBS-04, JOBS-05]

duration: 6min
completed: 2026-04-11
---

# Phase 07 Plan 01: BullMQ Jobs Summary

**BullMQ async job processing with PDF export via Playwright, SMTP email reminders, Bull Board monitoring, and 3-retry exponential backoff DLQ**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-11T00:11:27Z
- **Completed:** 2026-04-11T00:17:30Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- BullMQ module registered with Redis connection (maxRetriesPerRequest: null for worker compatibility)
- Two queues (pdf-export, email-reminder) with processors consuming jobs asynchronously
- PDF export processor: launches Playwright chromium, navigates to report print page, generates A4 PDF, saves to filesystem with SHA-256 checksum
- Email reminder processor: sends SMTP email via nodemailer and marks execution as sent
- Bull Board monitoring UI accessible at /admin/queues
- PdfExportService now enqueues BullMQ jobs with 3 retries and exponential backoff (5s, 10s, 20s)
- Graceful shutdown hooks enabled in main.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Install BullMQ dependencies and create BullMQ module with queue registration** - `d1e10d7` (feat)
2. **Task 2: Create PDF/email processors, Bull Board UI, and wire into AppModule** - `dac4f25` (feat)

## Files Created/Modified

- `apps/api/src/infrastructure/bullmq/bullmq.module.ts` - BullMQ forRoot with Redis connection and 2 queue registrations
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts` - Playwright-based PDF generation processor
- `apps/api/src/infrastructure/bullmq/email-reminder.processor.ts` - SMTP email sending processor
- `apps/api/src/infrastructure/bullmq/bull-board.module.ts` - Bull Board Express adapter mounted at /admin/queues
- `apps/api/src/infrastructure/email/email.service.ts` - Nodemailer SMTP wrapper with dev/prod modes
- `apps/api/src/infrastructure/config/env.schema.ts` - Added REDIS*\*, SMTP*\*, PDF_BASE_URL env vars
- `apps/api/src/modules/pdf-export/pdf-export.service.ts` - Added optional Queue injection and BullMQ enqueue
- `apps/api/src/modules/pdf-export/pdf-export.module.ts` - Wired pdf-export queue into service factory
- `apps/api/src/app.module.ts` - Imported BullMQModule, registered processors and EmailService
- `apps/api/src/main.ts` - Enabled shutdown hooks, mounted Bull Board
- `.env.example` - Added Redis, SMTP, and PDF config vars
- `apps/api/package.json` - Added playwright dependency

## Decisions Made

- **Queue as optional constructor param:** PdfExportService accepts Queue as optional 3rd param, preserving backward compatibility with existing unit tests that instantiate the service directly without NestJS DI
- **EmailService dev fallback:** When SMTP_HOST is absent (local dev), EmailService uses nodemailer's jsonTransport to log email payloads to stdout instead of failing
- **Bull Board auth deferred:** Bull Board is mounted at /admin/queues without auth middleware; JWT role-based auth will be layered in a follow-up

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed playwright dependency**

- **Found during:** Task 2 (PDF export processor)
- **Issue:** playwright was not in apps/api/package.json but is required by pdf-export.processor.ts
- **Fix:** Ran `pnpm add -F @customreport/api playwright`
- **Files modified:** apps/api/package.json
- **Verification:** TypeScript compilation passes
- **Committed in:** dac4f25 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed unused variable in EmailService**

- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `const info = await this.transporter.sendMail(...)` declared unused variable; strict TypeScript rejected it
- **Fix:** Removed the `const info =` assignment, keeping the await expression
- **Files modified:** apps/api/src/infrastructure/email/email.service.ts
- **Verification:** `tsc --noEmit` passes clean
- **Committed in:** dac4f25 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered

- Dependencies (bullmq, @nestjs/bullmq, nodemailer, etc.) were already in package.json from a prior attempt but not installed on disk; `pnpm install` resolved this
- Pre-existing ioredis type error in redis.health.ts was resolved by the same `pnpm install`

## User Setup Required

None - no external service configuration required. Redis and SMTP are configured via .env.example.

## Next Phase Readiness

- BullMQ infrastructure is ready for health check integration (07-02)
- Redis connection config is shared and can be reused by health indicators
- Docker Compose (07-03) needs Redis service with `--maxmemory-policy noeviction`

---

_Phase: 07-production-infrastructure_
_Completed: 2026-04-11_
