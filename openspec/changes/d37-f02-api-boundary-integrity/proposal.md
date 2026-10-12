# Proposal

## Why

Current API boundaries admit foreign annotation classification edits, leave failed or disconnected SSE streams unsettled, return reopened publications as draft current periods, lose structured carry-over diagnostics, and report an older on-time ratio as current. A post-commit publication count can also turn committed success into an unaudited failed tick.

## What Changes

- Preserve author-only original annotation fields and lifecycle-only reviewer updates.
- Settle SSE startup failures and admit writes only while the response is open.
- Add stable thread timestamp ties without altering message storage.
- Enforce the complete draft current-period tuple and use committed publication sections for audit count.
- Wire shared carry-over logging and retain latest nullable telemetry ratio separately from compact history.
- Remove the redundant SAML Role re-export after the existing blank-identity repair.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: author-only original fields, stream settlement and stable thread order.
- `period-scheduler-wiring`: current-period admission and committed publication audit count.
- `error-trace-correlation`: structured automatic carry-over diagnostics.
- `observability-metrics-coverage`: latest-period telemetry headline with compact history.

## Impact

Exact owned API/shared paths and explicitly granted existing tests in D37-F02 BRIEF. Root owns native acceptance, normal hooks/main publication and aggregate review. No dependency, migration or configuration changes.

## Non-goals

- Mutable feedback author/group scope, numeric sequence policy, history truncation or backpressure changes.
- PDF retry taxonomy widening, writes to cascade-deleted reminder rows, new SAML identities/types or wire arrays.
