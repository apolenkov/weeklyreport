# The unified by-state view is a derived presentation projection

**Status:** accepted and implemented. Current contract:
[lead-form-loaded-view-model](../../openspec/specs/lead-form-loaded-view-model/spec.md).

## Decision

The view groups work into Not started, In Progress, Paused, Planned Next,
Deferred, and Done. Buckets derive from `Item.type` and `workflowStatus`:
current `planned` means Not started, next `planned` means Planned Next, and
`postponed` means Deferred. `carriedOver` records provenance and does not change
the bucket. Alarms derive from covering risks and do not form a progress bucket.
No bucket value is persisted and the physical
`current | next` axis remains authoritative for submission and carry-over.

The projection is enabled by the organization setting and is deterministic.
Every combination of stored fields maps to a visible bucket; an unclassified
combination is a defect covered by unit tests.
