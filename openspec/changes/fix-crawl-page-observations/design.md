## Context

See proposal.md and accepted OCR tickets. The existing browser fixture uses named agent-browser sessions and synthetic HTTP pages; it touches no product database.

## Decisions

Serialize field state deterministically, excluding passwords and separating checked controls from text values. Keep full signature unchanged. For geometry use the rectangle/viewport intersection, retain DOM ancestry and label rules, and check hidden/clip overflow on both axes with native editable and intentional truncation exceptions.

Keep PerformanceObserver in the existing document activity state. Store bounded interval entries, yield the current browser task through native scheduling, combine delivered observations with takeRecords and use interval overlap to attribute duration. No arbitrary backoff or response-time formula changes. Native scheduling and takeRecords documentation: https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield and https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/takeRecords.

## Risks / Trade-offs

Observer delivery ordering is confirmed by native browser regressions. A timer yielding one task is a fallback where scheduler.yield is unavailable. Existing product lifecycle, role-coverage and destructive database contracts remain untouched. Rollback is the crawler-only commit; no migrations or delivery changes.
