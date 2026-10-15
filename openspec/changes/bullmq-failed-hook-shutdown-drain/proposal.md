## Why

TASK-503.24 (F489-3). The shared worker base runs the subclass `onJobFailed` hook inside a detached `void runInJobTraceContext(...)` in the `failed` listener. `worker.close()` waits for the job, not for this continuation, so `onModuleDestroy` can resolve while the hook (for PDF export: the terminal-state reconciliation in `PdfExportProcessor.onJobFailed`) is still writing, and the process can exit mid-update. Making the PDF override `async` does not change this: the hook already awaits its work, but the listener discards the promise.

## What Changes

- The base class tracks every in-flight failed-event hook continuation.
- `onModuleDestroy` waits for them after the worker has closed, for at most a bounded drain window (5 s, inside the container stop grace period); a hook still running at the deadline is logged once with the queue name and pending count, and shutdown proceeds.
- Hook rejections keep going to Sentry exactly as today; the PDF handler's internal catch and its startup/schedule recovery are unchanged.

## Capabilities

### Modified Capabilities

- `queue-worker-architecture`: shutdown waits for in-flight failed-event hooks.

## Impact

`apps/api/src/infrastructure/bullmq/raw-bullmq-processor.ts` and its test; all five processors inherit it. No schema, API or env change. Real worker-boundary proof (valid failed job → actual `worker.close` → restart repair) is the separate F489-3 acceptance on the synthetic lane; unit tests here use a mocked Worker and do not claim it.
