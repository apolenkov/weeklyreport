## Why

> Captured from 2026-06-30 demo feedback (cluster C2), grilled + adversarially
> verified. See `docs/feedback/decisions-locked-2026-06-30.md`.

Leads find report entry tedious and items get lost across periods. They want one fast
"quick add" and an optional unified by-state view, **without** changing the current
format for everyone. Carry-over already ships (`carryOver.execute` on `headProcedure`);
its write-path hardening is owned by the separate `fix-carryover-persistence`.

## What Changes

- **Quick-add affordance.** A single lead-form control picks a record type
  (current-item / next-item / decision / risk / blocker) and opens the EXISTING per-type
  dialog with the minimum required fields — reusing the validated schemas and the
  dialog lifecycle. "blocker" = a current `Item` with `workflowStatus=blocked` (no new
  model). All write invariants are kept (≥1 owned stage on item/risk — see C6 —, stage +
  product on decision, the unchanged submit gate); quick-add requires a stage tap,
  pre-selected when the lead owns exactly one.
- **Optional unified by-state view.** An opt-in view folds the current-week and
  next-week sections into one section grouped by **derived** buckets (done / in-progress
  / blocked / planned-next / deferred) computed from `Item.type` + `workflowStatus` +
  `completed` + `carriedOver` — a **presentation projection with no new persisted enum
  state**. There is no `failed` bucket. The classic two-section format stays the
  default; the unified view is gated behind an **org `AppSettings` flag** the head sets
  for the department.
- **Per-item move actions.** "mark complete" and "move to next week" mutate the existing
  row in place (same `Item.id`, flipping `workflowStatus`/`completed`/`type`) — never a
  clone, so C1 `RecordComment` anchors survive by the edit-persist rule.
- **Carry-over trigger UX.** Surface the existing head-manual `carryOver.execute` as a
  one-click "Copy forward unfinished" on period open. C2 does NOT touch the carry-over
  write path.

## Capabilities

### New Capabilities

- `unified-activity-entry`: the quick-entry affordance and the opt-in unified by-state
  view (a presentation projection over existing fields).

### Modified Capabilities

- (none formal — quick-add reuses `lead-dialog-lifecycle` / `record-dialog-layout`
  unchanged; the unified view is a new projection. Storage and the submit gate are
  untouched.)

## Impact

- Schema: an org `AppSettings` flag for the unified view (no record-shape change —
  physical `current|next` storage is preserved). MVP DBs disposable.
- API: a settings flag + read path (the only new write surface; on `leadProcedure` /
  admin settings as appropriate — canonical builders, no new Role). Quick-add and move
  actions reuse existing section-save procedures.
- Web: the quick-add control + the opt-in unified by-state section (a projection); the
  one-click carry-over trigger.
- **BLOCKED-until-`fix-carryover-persistence` merges** for the copy-forward UX (the
  current write path is known-buggy). Bucket function must be total + deterministic with
  explicit precedence; `carriedOver` means "arrived-from-last-period-as-current" (NOT
  deferred); `period-dual-state` is NOT a reader of `Item.type`.
- Out of scope: AI free-text → record (confirmed out); a real `failed`/`deferred` enum
  value; auto-trigger carry-over on period creation; any change to the carry-over write
  path, the submit gate, or the C1 review surfaces.
