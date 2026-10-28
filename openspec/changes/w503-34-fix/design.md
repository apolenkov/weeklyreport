## Context

`main.ts` must keep its dynamic imports of Sentry and OTel: static imports before `initializeSentry()` would break instrumentation order. The catch logic therefore moves into `bootstrap/boot-failure.ts`, which keeps the same dynamic imports and is unit-testable without running `start()`.

## Decisions

- Logger fallback: a stdout failure retries the entry on stderr and vice versa. If the second stream also throws, nothing is left to write to and the entry is dropped without throwing; this is the only silent case and is documented in code.
- OTel failure: stdout already carries the entry, so the failure is reported as one stderr line and not retried.
- Boot capture: `Sentry.captureException` runs before `shutdownSentry`, so the flush in `Sentry.close` delivers it. A throwing capture is caught and the drain still runs.
