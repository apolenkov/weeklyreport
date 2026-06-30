## Why

> **STUB — captured from 2026-06-30 demo feedback (cluster C2). NOT grilled yet.**
> High blast radius (`period-dual-state`, the lead form, carry-over). Grill before
> writing specs/tasks. See `docs/feedback/demo-2026-06-30.md`.

Leads find report entry tedious and items get lost across periods. They want one
fast "quick add" and a single, low-friction way to log weekly activity, while the
current format stays available.

## What Changes

- A single quick-entry affordance that picks the record type (item / current /
  next / decision / risk / block) and captures the minimum, fast.
- Optionally fold current-week / next-week into one section split by state
  (done / planned-next / deferred / failed).
- Carry-over so nothing is lost: copy-forward on opening the next period; move an
  item to complete or to next week.
- Keep the current format too — make the new mode opt-in, perhaps via settings.
- Future: an AI step that turns free text into the right record/action (out of
  scope for the first slice).

## Capabilities

### New Capabilities

- (TBD after grill) `unified-activity-entry`: the quick-entry surface and the
  optional combined current/next section model.

### Modified Capabilities

- (TBD after grill) the lead form / `period-dual-state` carry-over behavior.

## Impact

- Existing footing: `Item.type` (`current|next`), `Item.workflowStatus`,
  `Item.carriedOver`, and the working `apps/api/src/modules/carry-over/` service.
- High risk — touches the dual-state invariant and the lead form. Must be grilled
  and kept behind an opt-in so the current format is preserved.
