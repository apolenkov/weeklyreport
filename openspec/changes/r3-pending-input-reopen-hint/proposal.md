# Proposal

## Why

Tracking: TASK-503 (W503 R3 repair, C4836). While a lead has an unsaved
update open in the Overview, the report header actions — including
`Request reopen` — go disabled with an explanatory hint, and the surface
shows the "Unsaved update" state. The sibling change
`w503-r3-retro-behaviour-specs` specified only the locked-badge precedence
part of C4836, so the delivered behaviour has no requirement of its own and
the specifications no longer match the code. This change records it
retroactively. It changes no application code.

## What Changes

Retrospective specification of already delivered behaviour (commit
`c7f02a897`, C4836):

- While an unsaved update is open (`pendingInput`), every report header
  action control, including `Request reopen`, is disabled.
- The hint "Save or cancel the open update before using report actions."
  is shown next to the actions and the "Unsaved update — save or cancel
  the open edit" status is visible while the update is open.
- Saving or cancelling the update restores the actions, and the entered
  data survives the disabled window.

Not duplicated: the locked-badge precedence rule is already specified by
"Lead read-only state is stated in the header" in `report-toolbar-layout`,
and the sticky completion `Retry saving draft` rule is specified in
`lead-status-overview-actions`.

## Scope

One ADDED requirement for `report-toolbar-layout`. No application code,
schema, or other capability changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-toolbar-layout`: one requirement added.

## Impact

Specifications only. Delivered code, for reference:

- `apps/web/src/features/report-pages/ui/lead/chrome/lead-form-header-actions.tsx`
  (`fieldset disabled={pendingInput}` and the hint)
- `apps/web/src/features/report-pages/ui/lead/chrome/lead-form-header-actions.test.tsx`
