## Why

OCR C4114/C4124 show selects can become unavailable after probing, yet the crawler dispatches events and reports success. The accepted ticket ops-crawl-select-freshness supplies the scope and evidence.

## What Changes

- Validate live select and target option before dispatching events.
- Preserve exact full assignments; permit current-value alternatives only in quick mode.
- Record stale controls as explicit unsuccessful attempts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: native select action freshness and assignment integrity.

## Impact

Crawler batch, press result consumers, native browser regressions and the ui-crawl spec. No dependencies.

## Non-goals

- Product UI, API, infra, database E2E, crawl limits, credentials and dependency versions.
