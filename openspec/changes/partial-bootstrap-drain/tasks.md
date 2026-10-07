# Tasks

## 1. Early coordinator and signal wiring

- [x] 1.1 `bootstrapApi` creates the shutdown coordinator and registers
      SIGTERM/SIGINT via `registerApiShutdown` before the first async
      acquisition stage; the drain closers read whatever `owned` holds.
- [x] 1.2 `registerProcessErrorHandlers` moves inside the startup try, right
      after the container logger is armed — still before listen.

## 2. Startup failure boundary and drain coverage

- [x] 2.1 Bootstrap stages run inside one try/catch; the catch logs the
      original failure once and requests `fatal` on the coordinator — no
      second `process.exit`.
- [x] 2.2 `startup.aborted` short-circuits post-drain acquisitions: an app
      or rate-limit store created while the drain is pending is closed once
      by the boundary, never re-registered.
- [x] 2.3 No "listening" log and no success path after a shutdown request.
- [x] 2.4 `main.ts` catch drains initialized OTel/Sentry telemetry with a
      bounded deadline, then exits 1.
- [x] 2.5 `createNestApp` sets `abortOnError: false` and flushes the
      pre-boot logger once before propagating a failure.

## 3. Orchestration-boundary tests

- [x] 3.1 New `api-bootstrap.test.ts` with seam-based mocks covers: signal
      handlers before listen, pipeline rejection → ordered drain + exit 1,
      listen rejection → acquired resources drained once + exit 1, SIGTERM
      during a pending stage → drain without serving + single exit, and
      post-acquisition SIGTERM → the app is closed exactly once.
- [x] 3.2 Existing `api-shutdown`, `shutdown-coordinator`, and
      `process-error-handlers` tests keep passing unchanged.
