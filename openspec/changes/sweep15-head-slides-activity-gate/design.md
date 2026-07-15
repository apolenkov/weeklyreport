## Context

`HeadSlidesClient` starts weekly-report and activity queries together, then gates the entire render on either query's loading/error state. Activity rows are used only after weekly data proves `leadSections.length === 0`.

## Goals / Non-Goals

**Goals:** make activity state conditional on actual fallback use while preserving the empty-report fallback.

**Non-Goals:** change queries, slide models, viewer authorization, or activity contents.

## Decisions

Derive `needsActivityFallback` only after weekly report data has loaded and has no lead sections. Weekly loading/error/no-period remains authoritative first. Activity loading/error gates apply only when `enableActivity && needsActivityFallback`; populated weekly sections render immediately even if activity is slow or failed.

The activity query may remain enabled in parallel to avoid adding an empty-deck waterfall. Conditional rendering, not deferred request start, fixes the correctness issue while preserving empty-deck latency.

This change lands after `sweep15-placeholder-data-gating` so its tests use the settled query transition semantics.

## Risks / Trade-offs

- Background activity failure may still be logged when unused → keep it out of user-visible deck state; existing query telemetry may record it.
- Boolean drift between memo and gates → derive one named predicate and reuse it in slide construction, loading, and error branches.

## Invariants

Role coverage is preserved: viewers keep `enableActivity=false` and never call the head-only procedure. Other load-bearing invariants are untouched.
