---
phase: 04-production-hardening
plan: 02
type: summary
status: done
---

# Plan 04-02 Summary: Logging + E2E Hardening

## What was done

Added centralized structured JSON logging with daily file rotation and wired it into API bootstrap and all job-like services. Fixed pre-existing type mismatch in admin test.

### Task 1: Add centralized API logger with rotation

**Created** `apps/api/src/lib/logger.ts` — zero-dependency logger abstraction:
- `AppLogger` interface (debug/info/warn/error/child)
- `AppLoggerImpl` with structured JSON output to stdout/stderr + optional daily file rotation
- `NullLogger` for testing (null object pattern)
- Factory functions `createAppLogger()` and `createNullLogger()`
- Daily file rotation with configurable `maxFiles` (default 14) and auto-pruning
- `child(context)` for scoped logging with inherited base context

**Created** `apps/api/src/lib/logger.test.ts` — 12 tests covering:
- stdout/stderr routing by level
- minLevel filtering
- service name injection
- context merging
- daily log file creation and JSON line format
- old file pruning beyond maxFiles
- auto-creation of nested logDir
- child logger context inheritance and minLevel preservation
- NullLogger no-op behavior

**Wired into bootstrap** `apps/api/src/main.ts`:
- Creates logger with `LOG_LEVEL` and `LOG_DIR` env var support
- Logs bootstrap start/complete

**Wired into 5 services** (optional `logger?: AppLogger` parameter, defaults to NullLogger):

| Service | Log points |
|---------|-----------|
| `RemindersService` | execution creation, deduplication, mark sent |
| `PdfExportService` | export request, export completed |
| `CarryOverService` | carry-over execution with item/decision counts |
| `PublicationService` | report publish |
| `AdminService` | user upsert |

### Task 2: Apply deep design and E2E hardening fixes

- **Fixed** pre-existing type mismatch in `admin.service.test.ts`: local `AdminSnapshot` type was missing `reminderExecutions` field. Replaced with import from `@customreport/shared` and added the field to test fixture.
- **Fixed** unused import `basename` in `logger.ts`.

### Task 3: Re-run full verification

- **TypeScript typecheck**: PASS (zero errors)
- **Test suite**: 51 tests / 10 files — all PASS
- **Zero regressions**: optional logger parameter does not affect existing tests (NullLogger default)

## Files changed

- `apps/api/src/lib/logger.ts` (NEW)
- `apps/api/src/lib/logger.test.ts` (NEW)
- `apps/api/src/main.ts` (MODIFIED — logger bootstrap)
- `apps/api/src/modules/reminders/reminders.service.ts` (MODIFIED — optional logger)
- `apps/api/src/modules/pdf-export/pdf-export.service.ts` (MODIFIED — optional logger)
- `apps/api/src/modules/carry-over/carry-over.service.ts` (MODIFIED — optional logger)
- `apps/api/src/modules/publication/publication.service.ts` (MODIFIED — optional logger)
- `apps/api/src/modules/admin/admin.service.ts` (MODIFIED — optional logger)
- `apps/api/src/modules/admin/admin.service.test.ts` (MODIFIED — fix type mismatch)
