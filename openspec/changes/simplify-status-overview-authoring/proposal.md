## Why

Leads cannot quickly understand how to edit the Status Overview because one work item exposes competing item, continuation, icon, and drag interactions. The two supplied onUI reviews at `/lead/report/a0000000-0000-4000-8000-000000000001`, the current `status-overview-*` components, and the active continuation changes show that the technical lineage model has leaked into the basic authoring workflow.

## What Changes

- **BREAKING**: replace the separate `Add/Edit next step` authoring path with one work-item editor and explicit week selection.
- Present one stable row/card per work lineage with one primary `Edit` action and one product-level `Add item` action.
- Offer `Move to this week` and `Move to next week` through the same canonical editor/write path. The one editable occurrence lives in exactly one active week; moving preserves its stable identity and status, while the immutable prior-plan snapshot remains visible.
- When a new period opens, require the lead to confirm the prior Next plan before it becomes a Current update; opening a period MUST NOT claim progress automatically.
- Remove repeated drag instructions, unexplained icon actions, and priority controls from the basic Overview editor. Existing priority data remains intact and available to downstream consumers.
- Keep drag-and-drop only as an optional pointer shortcut for the same move/plan action; keyboard, touch, and labelled controls remain complete without it.
- Keep independent work independent rather than visually pairing unrelated Current and Next records.

### Non-goals

- Changing report lifecycle, permissions, publication, carry-over scheduling, or published snapshots.
- Deleting `nextStepText`, `priorityRank`, history, comments, or other persisted fields solely because the basic UI hides them.
- Adding drag-to-reorder or changing record ordering.
- Redesigning Head, Reviewer, or administration surfaces; this change completes the Lead flow first.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-status-overview`: simplify lead authoring to one item editor, explicit week planning, stable alignment, and optional DnD parity.
- `unified-report-authoring`: replace the user-visible next-step workflow with idempotent planning of the same logical work in Current or Next while retaining history.
- `carry-over-automation`: preserve status across period carry, represent carried Current work as awaiting confirmation, and keep manually moved Next work eligible across consecutive periods.
- `record-status-derivation`: allow a work item's progress status to survive an explicit Current/Next placement change while retaining pause reasons and risk-derived alarms.

## Impact

Primarily affects the complete Lead authoring route and its Status Overview editor bindings. Shared/API persistence and validation changes are permitted only where source tracing proves the current canonical path rejects the required idempotent week transition; no dependency or destructive database operation is planned.

## Status note

Implementation is complete, but the lead-status-overview and
unified-report-authoring deltas were never merged into `openspec/specs` and
partly conflict with the later `simplify-lead-weekly-cycle` (primary `Edit`
action versus one progress interaction). The carry-over-automation,
record-status-derivation, and "Tracked work" deltas were dropped: the first two
were superseded or already present, the last by `simplify-lead-weekly-cycle`.
Reconcile the remaining deltas with the current specs before archiving.
