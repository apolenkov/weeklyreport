# Proposal

## Why

Overview can close an edit before its payload is persisted and can silently abandon a failed save after a local-only restore. Lead reads/writes also have gaps at identity changes, role redirects, overlapping missing-section/support errors and pending delete confirmation. D37-F16 BRIEF original clauses and the published checkpoint define the bounded repairs.

## What Changes

- Bind Overview acknowledgement to detached persisted fields, identity, activation and exact submission.
- Persist failed-save discard through the existing single-flight engine, including equal-baseline payloads; retain input on unknown/failure/conflict and settle every intent once.
- Scope cross-author cache/display by trusted viewer identity and preserve current pending reads during obsolete-scope cleanup.
- Suspend unsent writes on role-away while preserving independent local-edit recognition.
- Preserve supporting Retry alongside missing section and isolate Overview UI state by report identity.
- Guard decision confirmation and normalize explicit completion; repair demonstrated product fallback loss.
- Remove dead continuation/touch-floor duplication and correct stale comments; reuse published encoder, attribution, item/stage and sole-stage fixes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-form-data-loading`: clarify isolated viewer-cache cleanup, scoped support recovery and role-away write suspension.
- `lead-form-draft-orchestration`: exact persisted edit acknowledgement and settled guarded discard ownership.

## Impact

Only BRIEF-authorized web owners/tests and this change. No backend input, schema, dependency, route, storage migration or cancellation of already-issued writes.

## Non-goals

- No novel role/order, blanket cache retention, rollback-after-CAS, timeout, fallback-person or logout policy.
- No performance claims or native HTTP/DB/browser/AT/whole-page acceptance.
- No duplicate implementation of published V17/V25/V32 or alteration of F19 `isSuccess` projection.
