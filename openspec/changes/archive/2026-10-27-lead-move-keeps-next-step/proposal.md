# Proposal

## Why

Lead Report Overview offered "Move to next week" for a Current item that already
carried a saved next step (`nextStepText`). Save ran the continuation-promotion
command instead of a placement change: the Current result was archived in the
outcome event, the stored next step became the Next text, and the Current cell
became empty — Continue semantics behind a Move label.

Keeping the placement and the commitment is blocked by the write contract: the
shared `addNextStepTextIssue` refinement rejects `nextStepText` on a Next item,
and the deployed `Item_next_step_check` constraint allows a nonblank commitment
only on unfinished Current work. A Next occurrence therefore cannot retain the
saved step without a schema and migration change, which the task forbids.

Task: TASK-707. The task lead chose option B: Move on such an occurrence
acknowledges the entered plan in place instead of asserting continuation, with
no write-contract or database change.

## What Changes

- Move to next week on a Current occurrence with a saved next step acknowledges
  the plan in place: the record keeps its placement, text, progress, `stableId`
  and `nextStepText`; only `carriedOver` clears through the ordinary draft save,
  and no continuation-promotion command runs.
- The Overview action skips the canonical editor and confirms in one step; the
  Lead form week-card arrow applies the same acknowledgement patch.
- A placement-only Move remains for Current occurrences without a saved next
  step, and the continuation-promotion command stays for moving a derived Next
  projection into Current. An editor week change that would drop a saved next
  step stays refused.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `record-status-derivation`: Move to next week changes placement or
  acknowledges a saved next-week plan, without asserting continuation.
- `lead-status-overview`: the Overview Move action follows that contract.

## Impact

`apps/web` only: lead item actions, the Overview openers and save path, the
Slides draft actions and their tests. No shared schema, API, persistence or
database change; `promotePlan` stays in the write port and server transaction
for the MOVE-NEXT-CURRENT direction.

## Non-goals

- No `nextStepText` on Next items, no write-schema or database-constraint change.
- No change to Continue next week, rolled-over Next precedence or the derived
  Next projection.
