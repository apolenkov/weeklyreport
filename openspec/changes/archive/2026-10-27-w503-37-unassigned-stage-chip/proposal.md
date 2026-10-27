# Proposal

## Why

An admin can remove a product stage from a lead's assignments after that lead
already saved an item, decision or risk on the stage. The record keeps its
stored stage names — the section guard deliberately accepts a record that keeps
its stored stages (C2903, `keepsStoredStages`) — but the shared stage control
only draws checkboxes for the stages the lead owns now. The leftover name is
invisible: it cannot be seen, confirmed or dropped from the dialog (C5035,
`StageMultiSelect` in `stage-multi-select.tsx`).

## What Changes

- The shared stage control renders each stored-but-unavailable stage name as a
  removable chip reading `<name> — no longer assigned`, so the saved value is
  visible instead of silently hidden.
- Removing the chip drops that name from the next `onChange` payload; the lead
  does not need an admin or another field to unblock the record.
- An untouched saved name stays in the payload: the server remains the
  authority on stage ownership (the C2903 unchanged-record rule), so the client
  does not decide the assignment is gone. Unavailable names never render as
  checkboxes and never feed the severity preview.
- No server, schema or API change.

## Non-goals

- No change to stage-ownership validation, the `keepsStoredStages` rule or the
  `STAGE_NOT_OWNED` message.
- No automatic removal or repair prompt; the lead decides when to drop a
  stored name.
- No assistive-technology or browser-navigation claim: this change is covered
  by component behaviour tests only (jsdom).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stage-step-shared-component`: adds a requirement that a stored stage outside
  the product's available list stays visible and removable, and stays in the
  payload until removed.

## Impact

`apps/web/src/features/report-sections/ui/stage-multi-select.tsx` and its
colocated `stage-multi-select.test.tsx` only. Callers (`StageStep` and the
Item, Decision and Risk dialogs) keep their existing props and payload type.
