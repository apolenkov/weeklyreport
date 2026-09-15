## Why

Leads need to continue tracked work into Next without losing the Current result, its comments or development history. The existing type-flip action clears the commitment; the requested Overview interaction instead preserves Current and creates a linked continuation.

## What Changes

- Preserve Current results while creating or editing linked Next commitments through pointer, keyboard and menu actions.
- Promote a continuation to current work while retaining the superseded result and comment lineage.
- Make conflicts, cancellation, ordering and failed-save recovery explicit.
- Expose scoped comments and readable development history for the same tracked work.

## Capabilities

### New Capabilities

- `tracked-work-continuation`: Linked continuation interactions, promotion, conflict handling and development history.

### Modified Capabilities

None. The existing `lead-status-overview` commitment projection and `record-comment-save-coordination` remain mandatory dependencies.

## Impact

Canonical draft actions, Overview rows, lineage/history persistence and record-comment consumers. Source anchors and user decisions are in parent `complete-exemplary-mvp-review/design.md` P06/P07; file ownership comes from the parent review packets. Serialize implementation with the existing quick-edit child.

## Non-goals

- Removing Current when creating Next, independent copies of the same work, rewriting published snapshots.
- Mobile, a new event framework, automatic text merging or a separate autosave endpoint.
