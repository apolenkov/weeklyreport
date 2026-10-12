# Proposal

## Why

Two confirmed defects remain on the current base:

- C4145: `rate.ts` treats every `mkdirSync` lock error as contention, so a permanent filesystem failure (EACCES, ENOTDIR, EROFS) spins forever on the poll interval instead of surfacing. Stale-lock cleanup and lock release failures are likewise swallowed, and a release failure after a failed ledger action hides the primary cause.
- F6921-3: the fetch instrumentation records HTTP status failures but a transport-level rejection handled by page code produces no evidence at all, leaving `PressResult.logs` empty while response errors are recorded.

## What Changes

- Retry lock acquisition only on `EEXIST`; rethrow every other acquisition failure with its original errno.
- Suppress only the released-meanwhile race (`ENOENT`) in stale-lock cleanup; surface other stat/removal failures.
- Keep the ledger action's failure primary when lock release also fails, with the release failure retained as secondary evidence; a standalone release failure still fails.
- Record one bounded `page-error` diagnostic for a non-Abort fetch rejection, with method and query-stripped URL and no error payload; rethrow the same rejection; report the same rejection object at most once through the global unhandled-rejection listener.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- ui-crawl: lock acquisition, stale-lock takeover and lock release failures fail closed instead of waiting forever or replacing the primary cause.
- ui-crawl: handled fetch transport failures produce bounded page-error evidence without duplicating the global rejection report.

## Impact

Owned `scripts/ui-crawl/rate.ts`, `scripts/ui-crawl/batch.ts`, `scripts/ui-crawl/constants.ts` (stale comment) and granted `rate.test.ts`, `press.test.ts`, `observations.browser.test.ts`. D37-F08 findings C4145 and F6921-3 define the repair; the other assigned cards are already satisfied by shipped fixes.

## Non-goals

- Stale-lock takeover timing, lock-heartbeat or concurrency scheduling policy (C4144 remains open).
- Malformed-ledger content policy, compaction or retention changes.
- XHR transport failure reporting beyond the existing status record, or any network/native browser acceptance claim.
