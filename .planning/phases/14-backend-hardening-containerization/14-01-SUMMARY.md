---
phase: 14-backend-hardening-containerization
plan: "01"
subsystem: api-testing
tags: [vitest, unit-tests, bullmq, trpc, auth-middleware]
dependency_graph:
  requires: []
  provides:
    - pdf-export-processor-unit-tests
    - email-reminder-processor-unit-tests
    - trpc-auth-middleware-unit-tests
  affects:
    - apps/api test coverage
tech_stack:
  added: []
  patterns:
    - vi.mock hoisting-safe factory pattern (setupMocks() helper)
    - (processor as any).processJob() for private method testing
    - router.createCaller(ctx) for tRPC middleware testing without HTTP transport
    - transitive import chain mocking to avoid workspace package resolution in worktree
key_files:
  created:
    - apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts
    - apps/api/src/infrastructure/bullmq/email-reminder.processor.test.ts
    - apps/api/src/infrastructure/trpc/trpc.middleware.test.ts
  modified: []
decisions:
  - Mock service modules (not just NestJS/BullMQ) to cut transitive @customreport/shared import chain in worktree
  - Use setupMocks() function instead of outer variables to satisfy vi.mock hoisting constraint
  - Test private processJob() via (processor as any) cast — no refactoring of production code needed
metrics:
  duration_minutes: 45
  completed: "2026-04-13T12:14:32Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
  tests_added: 15
---

# Phase 14 Plan 01: Unit Tests for Untested Backend Components Summary

Added unit tests covering the three backend components that had zero test coverage: BullMQ pdf-export processor (5 tests), BullMQ email-reminder processor (3 tests), and tRPC auth middleware (7 tests) — all 15 pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | BullMQ processor unit tests | 8da7ca0 | pdf-export.processor.test.ts, email-reminder.processor.test.ts |
| 2 | tRPC auth middleware unit tests | 983db55 | trpc.middleware.test.ts |

## What Was Built

### Task 1: BullMQ Processor Tests

**pdf-export.processor.test.ts** (5 tests):
- Launches Chromium with `headless: true`
- Navigates to `http://localhost:3000/reports/:reportId/print` with `waitUntil: 'networkidle'`
- Generates PDF with A4 format and `printBackground: true`
- Calls `markExportCompleted(jobId, '/pdfs/:jobId.pdf', hash)` with correct args
- Closes browser in `finally` block even when `page.goto()` throws

**email-reminder.processor.test.ts** (3 tests):
- Sends email with correct recipient and subject containing the report period
- Calls `markReminderSent(executionId)` after successful email send
- Does NOT call `markReminderSent` if `sendMail` throws (no partial state corruption)

### Task 2: tRPC Auth Middleware Tests

**trpc.middleware.test.ts** (7 tests):
- `publicProcedure` allows null session
- `protectedProcedure` rejects null session with `UNAUTHORIZED`
- `protectedProcedure` allows lead session
- `headProcedure` rejects lead session with `FORBIDDEN`
- `headProcedure` allows head session
- `headProcedure` rejects null session with `UNAUTHORIZED`
- Thrown errors are `TRPCError` instances

## Decisions Made

**Mock service modules, not just external packages**
The processors import service files (`reminders.service.ts`, `pdf-export.service.ts`) which transitively import `@customreport/shared`. In the worktree environment (empty node_modules), this breaks resolution. Mocking the service module paths directly cuts the chain cleanly without any production code changes.

**setupMocks() helper for Playwright mocks**
`vi.mock` factories are hoisted above variable declarations at module level. Using an outer `mockBrowser` variable inside a vi.mock factory causes `ReferenceError: Cannot access 'mockBrowser' before initialization`. Moving mock object creation into a `setupMocks()` function called in `beforeEach` or each test keeps factory code side-effect-free.

**No production code changes**
The `processJob` method is `private` in both processors. Rather than refactoring to `protected` or extracting to a public interface, tests use `(processor as any).processJob(job)` — a standard pattern for testing implementation details in TypeScript when the method signature is stable and refactoring would add unnecessary abstraction.

## Test Coverage Result

New unit tests: 15 (5 + 3 + 7)
Pre-existing passing unit tests: 93
Total unit tests passing: 108

Integration tests (9 files) require a live PostgreSQL connection and fail in this environment — this is a pre-existing condition unrelated to this plan.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: apps/api/src/infrastructure/bullmq/pdf-export.processor.test.ts
- FOUND: apps/api/src/infrastructure/bullmq/email-reminder.processor.test.ts
- FOUND: apps/api/src/infrastructure/trpc/trpc.middleware.test.ts

Commits verified:
- FOUND: 8da7ca0 feat(14-01): add BullMQ processor unit tests
- FOUND: 983db55 test(14-01): add tRPC auth middleware unit tests
