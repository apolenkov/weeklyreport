## Why

Failed or aborted captures appear as PNG or directory links, making missing evidence look available. Accepted ops-crawl-artifact-presence covers OCR C4141/C4150/C4186 and their proof.

## What Changes

- Represent unavailable page screenshots as null through production, relativization and merging.
- Confirm screenshot command success before returning a filename.
- Preserve capture diagnostics and restore changed surfaces even when a screenshot fails.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: screenshot evidence availability.

## Impact

Crawler types, quick/full page producers, press, worker, merge and regression tests. No dependencies.

## Non-goals

- Video schema (separate next ticket), product UI/API/infra, database E2E, lifecycle and delivery settings.
