# The unified by-state view is a derived presentation projection, not new persisted state

**Status:** accepted and implemented (archived as
`openspec/changes/archive/2026-07-02-unified-activity-entry`; current contract:
`openspec/specs/lead-form-loaded-view-model/spec.md`)

## Context

Demo feedback (cluster C2) asked for a unified "by state" view of a lead's work —
one section grouped into buckets (done / in-progress / blocked / planned-next /
deferred) instead of the classic Current-week / Next-week split. The obvious
modelling adds a new persisted state enum to `Item`.

That breaks on what the report already stores. An `Item` carries `type`
(`current | next`), `workflowStatus`, and `carriedOver` — the bucket is fully
derivable from those fields. A persisted bucket enum would:

- duplicate state that already exists, inviting divergence between the stored
  bucket and the fields it was derived from;
- require a schema migration and a dual-write on every item mutation;
- risk drifting from the physical `current | next` storage that the submit gate
  and the carry-over filter depend on. `period-dual-state` is not a reader of
  `Item.type`, but the submit gate (≥1 current item) and the carry-over engine
  are — so the physical axis must stay authoritative.

The fields are not orthogonal (`type` constrains the allowed workflow statuses),
so any derivation needs an explicit precedence, and there is no `failed` bucket
in the locked set. `carriedOver` means "arrived from the previous period as
current" — it must not be presented as "deferred".

## Decision

The unified by-state view is a **derived presentation projection**, not stored
state:

- The buckets are computed by a total, deterministic function over the existing
  `Item` fields with an explicit, documented precedence. No new persisted enum
  value is written.
- Physical `Item.type` (`current | next`) storage is preserved unchanged, so the
  submit gate and the carry-over filter are unaffected.
- The view is opt-in, gated behind an **org `AppSettings` flag** an administrator flips
  for the department (not client-only, not per-lead). With the flag off, the
  classic two-section format renders — that stays the default.
- There is no `failed` bucket; `carriedOver` is bucketed by current workflow
  state, never surfaced as "deferred".

The per-item move actions ("mark complete", "move to next week") update the
item's workflow fields without creating a second logical record. Save may
recreate the database row, but it preserves `stableId`, so C1 `RecordComment`
anchors and carry-over lineage remain attached to the same позиция.

## Consequences

- No migration and no new write path for bucket state; the projection function
  is the single source of the buckets, so they can never disagree with the
  stored fields.
- Turning the feature off (or back on) is a settings flip with no data change —
  the experiment is fully reversible.
- The submit gate and carry-over keep reading the unchanged physical `Item.type`,
  so `period-dual-state` and the carry-over invariants are untouched.
- The bucket precedence is load-bearing product logic and must be covered by a
  total-function unit test; an un-bucketed combination of fields is a defect, not
  a silent fallthrough.
