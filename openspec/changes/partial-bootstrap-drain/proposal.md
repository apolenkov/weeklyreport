# Proposal

## Why

The ordered API drain only ran for a fully started server: signal handlers
were registered after `app.listen`, and any startup rejection went to an
immediate `process.exit(1)` in `main.ts`. A failed pipeline stage, a failed
listen, or a SIGTERM during pending startup leaked the Nest app, the
rate-limit Redis store, and initialized OTel/Sentry telemetry.

## What Changes

- The shutdown coordinator and signal handlers exist before the first async
  acquisition stage in `bootstrapApi`. Unacquired resources keep no-op
  closers; each acquired resource arms its closer in place, so the single
  drain covers exactly what was acquired — never twice.
- A startup failure or termination signal during pending startup requests
  the shared fatal/signal drain instead of bypassing it. A resource acquired
  while a drain is already running is closed once by the startup boundary
  and is not re-registered.
- A startup-stage failure keeps the original error observable (logged before
  the fatal request) and still exits 1 through the coordinator — there is no
  second `process.exit` racing it.
- A failure before the Nest app exists (env validation, `createNestApp`)
  drains initialized telemetry only — bounded — via the `main.ts` boundary,
  then exits 1.
- `createNestApp` passes `abortOnError: false` so provider-init failures
  reject to the failure boundary instead of calling `process.abort`, and it
  flushes its pre-bootstrap logger once before propagating the failure.

## Capabilities

### api-shutdown-coordination

Extends the existing coordination contract to partial bootstrap: the drain
covers resources acquired up to the failure point, startup termination is
bounded and single-exit, and signal/fatal handling is armed before listen.

## Impact

- `apps/api/src/bootstrap/api-bootstrap.ts` — early coordinator, startup
  failure boundary, orphan-close for post-drain acquisitions.
- `apps/api/src/bootstrap/nest-app.ts` — `abortOnError: false`, pre-boot
  logger flush on failure.
- `apps/api/src/main.ts` — bounded telemetry drain before `process.exit(1)`.
- `apps/api/src/bootstrap/api-bootstrap.test.ts` — orchestration-boundary
  regression tests.
- No deployment, schema, or dependency changes.
