## Why

A cold PDF export can finish after the web client has lost the active job identity. Browser acceptance reproduced a head export that remained unavailable even though the worker completed the job in four seconds: compiling the print route transiently remounted the export control, and its React-local `jobId` reset to null. A browser refresh or any other control remount has the same product failure mode. The interval predicate is also expressed as an allowlist of transient states instead of stopping only on canonical terminal results.

## What Changes

- Keep polling a PDF export while its status is unavailable or non-terminal.
- Stop polling only after the canonical terminal statuses `completed` or `failed`.
- Preserve an active job ID for the current browser tab so polling resumes after a control remount or refresh, then remove it on completion, failure, or status-query error.
- Add focused regression tests for the polling decision and remount recovery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: asynchronous export status polling must continue until a terminal result is observed.

## Non-goals

- Changing the public PDF status enum, queue topology, worker retry policy, or artifact delivery behavior.
- Adding a persistent browser, E2E, or UAT harness.

## Impact

The change is limited to the PDF export web hook, its colocated unit test, and the durable PDF integrity specification. The tab-scoped job ID is opaque and remains ownership-checked by the API. API and database contracts remain unchanged.
