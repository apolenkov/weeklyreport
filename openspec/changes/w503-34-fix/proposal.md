## Why

TASK-503.34 (wave-7 rev-waves-1 FAIL, findings C0595 and C0620). Two boot and logging paths let a telemetry or capture fault escape or get lost:

- `AppLogger.emit` (`apps/api/src/lib/logger.ts`) calls `process.stdout.write`, `process.stderr.write` and the OTel `logs.emit` with no guard. A throw from any of them propagates into business code that merely logged.
- The boot-failure catch (`apps/api/src/main.ts`) prints the error and drains OTel and Sentry, but never calls `Sentry.captureException`, so a failure before bootstrap never reaches Sentry.

## What Changes

- A log call never throws into its caller. A failed stdout/stderr write moves the entry to the other standard stream, prefixed with a diagnostic line; an OTel emit failure is reported on stderr. The entry is never dropped while one stream still accepts writes.
- The boot-failure handler captures the original error with Sentry before the bounded telemetry drain, guarded so a capture failure neither masks the failure nor skips the drain. The process still exits 1.

## Capabilities

### New Capabilities

- `api-logger-transport`: log calls are isolated from transport failures.
- `api-boot-failure-capture`: a failure before bootstrap is captured by Sentry before telemetry drains.

## Impact

`apps/api/src/lib/logger.ts` and `logger-transport.test.ts`; `apps/api/src/main.ts` delegating to a new `apps/api/src/bootstrap/boot-failure.ts` and its test. No schema, API, env or dependency change. Acceptance on the Linux stand (C0593) is not claimed here.
