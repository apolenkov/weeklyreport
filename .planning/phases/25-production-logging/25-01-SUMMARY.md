---
phase: 25
plan: 01
subsystem: production-logging
tags: [logging, observability, correlation-id, nestjs-cls, trpc]
requires: [LOG-01, LOG-02, LOG-03, LOG-04, LOG-05]
provides:
  - "AppLoggerImpl reads correlationId from CLS, falls back to 'no-context'"
  - "Single active app.log with size-based gzip rotation and mtime-based pruning"
  - "Async file writes via fs.promises.appendFile, serialized per-logDir"
  - "tRPC loggingMiddleware emits structured entry/exit lines per procedure"
  - "ClsModule globally available; CorrelationIdMiddleware writes correlationId into CLS"
affects:
  - "apps/api/src/infrastructure/middleware/correlation-id.middleware.ts"
  - "apps/api/src/lib/logger.ts"
  - "apps/api/src/infrastructure/trpc/trpc.middleware.ts"
  - "apps/api/src/infrastructure/trpc/trpc.context.ts"
  - "apps/api/src/app.module.ts"
  - "apps/api/src/main.ts"
tech-stack:
  added:
    - "nestjs-cls@^6.2.0"
  patterns:
    - "AsyncLocalStorage via ClsModule.forRoot({ global, middleware: { mount } })"
    - "Fire-and-forget file logging with per-sink promise queue"
    - "stream.pipeline + zlib.createGzip for log archival"
key-files:
  created:
    - "apps/api/src/infrastructure/middleware/correlation-id.middleware.test.ts"
  modified:
    - "apps/api/src/infrastructure/middleware/correlation-id.middleware.ts"
    - "apps/api/src/app.module.ts"
    - "apps/api/src/lib/logger.ts"
    - "apps/api/src/lib/logger.test.ts"
    - "apps/api/src/main.ts"
    - "apps/api/src/infrastructure/trpc/trpc.middleware.ts"
    - "apps/api/src/infrastructure/trpc/trpc.middleware.test.ts"
    - "apps/api/src/infrastructure/trpc/trpc.context.ts"
    - "apps/api/package.json"
decisions:
  - "Enhanced AppLoggerImpl in place rather than replacing with pino, per CONTEXT.md"
  - "Logger remains a factory (not a NestJS provider); ClsService is passed via LoggerOptions.clsService"
  - "loggingMiddleware applied BEFORE auth so failed-auth attempts are recorded"
  - "Replaced daily-prefix scheme with single app.log + size-based gzip archives"
  - "maxBytes default 50MB, maxAgeDays default 30 (overridable via LoggerOptions)"
metrics:
  duration: "~50min"
  completed: "2026-04-26"
---

# Phase 25 Plan 01: Production Logging Summary

End-to-end correlation IDs for the API: every tRPC request produces one entry log and one exit log carrying the same `correlationId` as the `x-request-id` response header, persisted to a rotating `app.log` without blocking the event loop.

## What shipped

- **nestjs-cls@^6.2.0** wired as a global module with `middleware.mount: true` and `generateId: false`, mounted before any user middleware so the CLS store is active by the time `CorrelationIdMiddleware` runs.
- **CorrelationIdMiddleware** now injects `ClsService` and writes the resolved id into the store: `cls.set('correlationId', id)` alongside the existing `req.headers['x-request-id']` and `res.setHeader('x-request-id', ...)` writes.
- **AppLoggerImpl** rewritten on the file path:
  - `appendFileSync` removed from the hot path; replaced with `fs.promises.appendFile`
  - File work is fire-and-forget but **serialized per logDir** through a shared promise queue in the logger instance; this prevents append/rotate interleaving without changing the `emit()` signature
  - Active file is always `<logDir>/app.log`; on threshold crossing the file is gzip-streamed (`createReadStream → createGzip → createWriteStream` via `stream/promises.pipeline`) into `app.log.<ISO-stamp>.gz` and then `fs.truncate(activePath, 0)` is called (faster than unlink+recreate, keeps inode handle stable)
  - Retention by **mtime age** (`maxAgeDays`, default 30); the legacy `maxFiles` option is preserved for back-compat but documented as deprecated
  - Every entry now includes `correlationId`: from CLS when `clsService.isActive()` is true, otherwise the literal `'no-context'`
  - `child()` forwards `clsService`, `maxBytes`, `maxAgeDays`, AND the parent's file sink so child loggers do not race with the parent on writes
- **tRPC `loggingMiddleware`** chained into all three procedure helpers BEFORE auth:
  - Entry: `info('trpc request start', { phase: 'trpc.request', stage: 'start', procedure, type, userId })`
  - Exit (success): `info('trpc request end', { ..., stage: 'end', duration, status: 'success' })`
  - Exit (error): `error('trpc request end', { ..., status: 'error', error: { code, message } })` — code+message only, no stack
  - `duration` is computed from `performance.now()` and rounded to ms
- **TrpcContext** now carries `logger: AppLogger`; `createContextFactory` takes the logger and threads it into every returned context (token-valid path, AUTH_DEV_MODE fallback, anonymous fallthrough).
- **main.ts** resolves `ClsService` from the Nest container and passes it into `createAppLogger(...)`. The pre-Nest "starting" message is now a `console.log` since no logger exists before `NestFactory.create` returns.

## Decisions made

| Decision                         | Choice                             | Why                                                                                                          |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Replace logger?                  | No — enhance                       | Per CONTEXT.md "Don't Replace Logger"; service-level loggers across the codebase already consume `AppLogger` |
| Where to store correlationId     | CLS store via `nestjs-cls`         | D-01; avoids threading id through every service call                                                         |
| Logger as NestJS provider?       | No, keep as factory                | Existing wiring pattern; ClsService is passed via `LoggerOptions.clsService` from `main.ts`                  |
| Logging middleware order vs auth | Logging FIRST, auth second         | Captures failed-auth attempts (security forensics > anonymous-noise risk); per D-02 trade-off                |
| Rotation strategy                | Single `app.log` + size-based gzip | CONTEXT.md "File Rotation"; simpler than daily-prefix and gives predictable disk use                         |
| maxBytes default                 | 50 MiB                             | CONTEXT.md default; balances rotation frequency vs archive count                                             |
| maxAgeDays default               | 30 days                            | CONTEXT.md default; matches typical operational debugging window                                             |
| Serialization of file work       | Per-logger promise queue           | Prevents `appendFile` racing with the `pipeline` during rotation; documented in inline comment               |

## Tests added/updated

| Suite                               | Count                                                                            | Notes                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `correlation-id.middleware.test.ts` | 3 (new file)                                                                     | UUID generation, header preservation, per-request isolation                                                                          |
| `logger.test.ts`                    | 17 (rewritten)                                                                   | async write, gzip rotation + magic-byte check, age-based pruning, CLS active/inactive/missing branches, child-logger CLS inheritance |
| `trpc.middleware.test.ts`           | 15 (4 new logging cases + 11 existing auth cases updated for `logger` ctx field) | success/error/authed-userId/anonymous-userId logging; all original auth assertions preserved                                         |

Full apps/api unit suite: **29 files / 398 tests passing**.

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Promise-queue file sink instead of plain fire-and-forget**

- **Found during:** Task 2 implementation
- **Issue:** Plain `void writeToFile(...)` per the plan body would let two emit() calls interleave their `appendFile` and `pipeline` (rotation) operations, corrupting the rotated archive or duplicating lines.
- **Fix:** Each `AppLoggerImpl` carries a `FileSink` whose `queue` promise serializes `rotateIfNeeded → appendFile`. Children inherit the parent's sink, so a parent + child writing in parallel still serialize. Errors still drain via `process.stderr.write` exactly as the plan specified. `emit()` stays synchronous from the caller's POV.
- **Files modified:** `apps/api/src/lib/logger.ts`
- **Commit:** `0883b1f`

**2. [Rule 1 - Test fix] Rotation test size assertion replaced with gzip magic-byte assertion**

- **Found during:** Task 2 verification
- **Issue:** The plan's suggested assertion (active log size < 200 after rotation) is timing-dependent — by the time the test reads the file, several post-rotation lines may have been written.
- **Fix:** Assert (a) at least one `app.log.*.gz` archive exists, (b) it begins with the gzip magic bytes `0x1f 0x8b`, and (c) the active file is smaller than the un-rotated total. Same coverage, deterministic.
- **Files modified:** `apps/api/src/lib/logger.test.ts`
- **Commit:** `0883b1f`

**3. [Pre-existing, out of scope] Typecheck fails on unrelated file**

- `apps/api/src/modules/period/period.contract.test.ts:65` has an unused `userId` variable (TS6133). It fails `pnpm typecheck` before this plan's first commit and is not touched by any task here. Logged as deferred for a future GSD pass; not fixed per scope-boundary rules.

## Auth gates

None — purely backend work, no external auth needed.

## Smoke-test guidance (not blocking)

The plan's example `curl` path `period.getActive` does not exist on the router. Use one of:

```bash
curl -H "x-request-id: smoke-$(date +%s)" \
  -X POST http://localhost:3001/trpc/weeklyReport.get \
  -H 'content-type: application/json' -d '{}'
```

Then in `apps/api/logs/app.log` you should see two consecutive lines whose `correlationId` matches the `smoke-…` header, one with `"stage":"start"` and one with `"stage":"end"` plus a numeric `duration` and `"status":"success"`.

## Self-Check: PASSED

Files claimed:

- FOUND: `apps/api/src/infrastructure/middleware/correlation-id.middleware.test.ts`
- FOUND: `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`
- FOUND: `apps/api/src/app.module.ts`
- FOUND: `apps/api/src/lib/logger.ts`
- FOUND: `apps/api/src/lib/logger.test.ts`
- FOUND: `apps/api/src/main.ts`
- FOUND: `apps/api/src/infrastructure/trpc/trpc.middleware.ts`
- FOUND: `apps/api/src/infrastructure/trpc/trpc.middleware.test.ts`
- FOUND: `apps/api/src/infrastructure/trpc/trpc.context.ts`

Commits claimed (verified via `git log`):

- FOUND: `51d74be` feat(api): wire nestjs-cls and propagate correlationId into CLS store [LOG-01]
- FOUND: `0883b1f` feat(api): async file logging with size-based gzip rotation and CLS correlationId [LOG-03,LOG-04,LOG-05]
- FOUND: `f647247` feat(api): tRPC request/response logging middleware with duration and status [LOG-02]

Test runs:

- 3 target suites: 35/35 passing
- Full apps/api unit suite: 398/398 passing
