## Why

A browser timeout followed by a failed page restore currently loses completed presses and hides the original timeout. C4185 requires preserved evidence and termination of dependent actions on an unknown page.

## What Changes

- Read saved press results before attempting recovery operations.
- Keep recovery-read, dismiss and restore failures separately from the original timeout.
- Stop further page actions after failed restoration and mark coverage incomplete.
- Retain the request reservation when its actual consumption is unknown.
- Add regressions at the page-round and batch recovery boundaries.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: failed recovery preserves observed actions and aborts dependent traversal.

## Impact

Crawler batch, press and round modules. Existing incomplete-run policy consumes the coverage finding. No dependency, database, application UI or delivery changes.

## Non-goals

Login, control identity, selectors, select assignment and browser timeout transport fixes belong to their own groups.
