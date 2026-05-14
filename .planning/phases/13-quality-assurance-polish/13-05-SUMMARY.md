---
phase: 13-quality-assurance-polish
plan: 05
subsystem: api-tests
tags: [testing, vitest, bug-regression, service-layer]
dependency_graph:
  requires: [13-01]
  provides: [regression-tests-for-bug-fixes]
  affects: [api-service-modules]
tech_stack:
  added: []
  patterns: [mock-repository, env-cleanup-in-tests, idempotency-verification]
key_files:
  created: []
  modified:
    - apps/api/src/modules/report-sections/report-sections.service.test.ts
    - apps/api/src/modules/carry-over/carry-over.service.test.ts
    - apps/api/src/modules/reminders/reminders.service.test.ts
    - apps/api/src/modules/admin/admin.service.test.ts
    - apps/api/src/modules/pdf-export/pdf-export.service.test.ts
    - apps/api/src/modules/auth/auth.e2e.spec.ts
decisions:
  - Used mock repository pattern (consistent with existing test patterns) instead of DI mocks
  - Auth cookie tests verify createSessionCookie + createAuthController (unit level, not HTTP-level)
  - Env var cleanup uses try/finally to avoid test pollution
metrics:
  duration: 10m
  completed: 2026-04-12
  tests_added: 29
  total_tests: 68
---

# Phase 13 Plan 05: API Service Bug-Fix Regression Tests Summary

29 new Vitest tests across 6 API modules verifying all bug-fix code paths from Plan 01, covering published-report guards, carry-over idempotency with multi-section processing, dedupeKey email inclusion, markExportFailed, auth cookie env configuration, and admin cascade deletion.

## Tasks Completed

### Task 1: Tests for report-sections, carry-over, and reminders (14 tests)

**report-sections.service.test.ts** (4 new tests):

- saveDraft rejects when report is published (FORBIDDEN guard)
- saveDraft succeeds when report is draft
- saveDraft calls getReportStatus with correct reportId
- saveDraft rejects when section is already submitted

**carry-over.service.test.ts** (5 new tests):

- Processes ALL source sections (3 sections, verifies 4 records and correct item/decision counts)
- Returns existing execution without new records (idempotency)
- Creates new execution when none exists
- Throws when source sections are empty
- Throws when target sections are empty

**reminders.service.test.ts** (5 new tests):

- Reads kind from DB field (deadline rule mapping)
- Reads kind from DB field (weekly rule mapping)
- Different recipient emails generate different dedupeKeys
- Same email + rule + fireAt produces same dedupeKey (deterministic)
- dedupeKey string contains recipientEmail

**Commit:** 9b30b0c

### Task 2: Tests for admin, PDF export, and auth (15 tests)

**admin.service.test.ts** (4 new tests):

- removeUser removes user from snapshot
- removeUser preserves other users
- removeUser handles non-existent user gracefully
- removeProject archives instead of deleting
- removeReminderRule deletes from snapshot

**pdf-export.service.test.ts** (6 new tests):

- markExportFailed updates job status to failed
- markExportFailed calls repository with correct parameters
- buildAuthCookies uses AUTH_JWT_COOKIE_NAME from env
- buildAuthCookies falls back to default cookie name
- buildAuthCookies sets httpOnly to true
- buildAuthCookies extracts domain from PDF_BASE_URL

**auth.e2e.spec.ts** (4 new tests):

- createSessionCookie uses AUTH_JWT_COOKIE_NAME from env
- Custom cookie name produces correct Set-Cookie header
- Falls back to customreport_session when env not set
- issueSessionCookie produces cookie with configured name

**Commit:** edd3f6b

## Verification

All 68 tests pass (39 original + 29 new):

```
Test Files  9 passed (9)
Tests       68 passed (68)
Duration    418ms
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed parse errors from orphaned closing brackets**

- **Found during:** Task 1 and Task 2
- **Issue:** New describe blocks inserted before `describe('router')` blocks created orphaned `});` closing brackets that broke the TypeScript parser
- **Fix:** Removed extra `});` closings in reminders, admin, and pdf-export test files
- **Files modified:** reminders.service.test.ts, admin.service.test.ts, pdf-export.service.test.ts

## Known Stubs

None. All tests verify real service behavior against mock repositories.

## Self-Check: PASSED

- All 6 modified test files exist on disk
- SUMMARY.md created at .planning/phases/13-quality-assurance-polish/13-05-SUMMARY.md
- Commit 9b30b0c (Task 1) found in git log
- Commit edd3f6b (Task 2) found in git log
- All 68 tests pass
