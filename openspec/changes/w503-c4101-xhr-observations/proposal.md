# Proposal

## Why

Crawler reports can repeat an old request URL when a page reuses an XMLHttpRequest. TASK-503 C4101 reproduced two real GET requests producing three network rows on the current `scripts/ui-crawl/batch.ts`; the activity counter returned to zero.

## What Changes

- Keep one lifecycle listener pair per XMLHttpRequest and use its current request metadata.
- Add a native regression to `scripts/ui-crawl/observations.browser.test.ts` proving two requests produce two correctly attributed network rows.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: network observations retain the current request identity when an XMLHttpRequest is reused.

## Impact

Only crawler instrumentation and its existing native fixture test change. No dependency, application API, database or Redis change is needed. Evidence is retained outside Git in `~/work/handoffs/task-503/wave-05/`.

## Non-goals

- Change input role mapping, crawl policy, request pacing or beforeunload handling.
- Treat repeated log entries as a demonstrated in-flight request leak.
