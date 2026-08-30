# The unified by-state view is a derived presentation projection

**Status:** accepted and implemented. Current contract:
`openspec/specs/lead-form-loaded-view-model/spec.md`.

## Decision

The view groups work into done, in-progress, blocked, and planned-next buckets.
Buckets are computed from the existing `Item.type`, `workflowStatus`, and
`carriedOver` fields. No bucket value is persisted and the physical
`current | next` axis remains authoritative for submission and carry-over.

The projection is enabled by the organization setting and is deterministic.
Every combination of stored fields maps to a visible bucket; an unclassified
combination is a defect covered by unit tests.
