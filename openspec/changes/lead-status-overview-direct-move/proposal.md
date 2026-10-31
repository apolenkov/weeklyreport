# Change: Direct Move to Next in Lead Status Overview (TASK-766 / TASK-707 p10)

## Why

In the Lead Report Status Overview, moving an eligible Current occurrence to Next week when no forward plan input is needed previously required opening the full canonical editor and clicking "Save update" (3 clicks: `…` → `Move to next week` → `Save update`).
As audited in `TASK-707` / `base707-RESULT.md` (item 10), this was a measured click-cost failure (3 clicks vs 2 clicks target).
Following owner decision 28.10 22:55 ("Ну я бы доделал всё"), selecting "Move to next week" for an eligible Current occurrence without a separate next commitment or requiring input directly applies the move patch (`buildMoveItemPatch`) via the standard draft autosave pipeline without opening the editor. The canonical editor remains available via "Edit details" for changes, and Move to this week keeps its editor path.

## What Changes

1. **Direct move execution**: In `use-overview-openers.ts`, when `moveItem` is invoked with target `next` for an eligible item without a saved next step, `buildMoveItemPatch` is directly applied to the draft (`ready.draft.apply(patch)`) if valid, triggering standard draft autosave and toast confirmation ("Moved to next week"), matching `acknowledgeSavedNextWeekPlan`. If `buildMoveItemPatch` cannot be built or item is not movable directly, fallback to `openEditItem`.
2. **Rollover and domain invariants preserved**: The action reuses `buildMoveItemPatch` directly. It preserves `stableId`, updates `type: current -> next`, retains progress and text, clears `carriedOver`, does not assert continuation, and strictly enforces the invariant of at most one active W+1 occurrence per `stableId`.
3. **Spec deltas**: Updated `lead-status-overview` and `record-status-derivation` specifications to specify direct application on selection.
