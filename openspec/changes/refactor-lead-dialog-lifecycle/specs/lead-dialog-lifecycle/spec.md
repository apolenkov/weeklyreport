## ADDED Requirements

### Requirement: Editable lead sections source dialog lifecycle from the shared hook

Every editable lead report section MUST acquire its dialog lifecycle
from the shared `useEditableListDialog` hook in `apps/web/src` —
this covers current week, next week, risks, decisions, and any later
addition. The hook owns:
dialog open/edit/close state, the add-signal open effect with the D1
readOnly-ref semantics (including reset when the surface enters a
read-only view, per `lead-report-controls-integrity`), openSeq keying
(D13), and pending-delete confirmation. Section-specific behavior
(`wasEmpty`/`onRiskFilled`, seed product) stays in caller-side
`onSave` wrappers; a section MUST NOT re-implement the lifecycle
locally.

#### Scenario: a fifth editable section is added

- **WHEN** a developer adds a new editable entity section to the lead
  report page
- **THEN** the section wires `useEditableListDialog` and defines no
  local dialog-state union, add-signal effect, or pending-delete state

#### Scenario: a stale add counter survives a view transition

- **WHEN** the lead opens any section's create dialog, cancels, views
  a snapshot, and returns to the editable view
- **THEN** no dialog opens in any section — the hook owns the reset
  uniformly, so the D1 fix can never again reach only a subset of
  sections

### Requirement: Edit dialogs mount through DialogShell

The lead edit dialogs (item, risk, decision) MUST mount and unmount
their form content through the shared `DialogShell` wrapper
(canonical D12 pattern from `item-edit-dialog.tsx`), so reopening a
dialog remounts fresh state structurally. The dialogs MUST NOT carry
`"use no memo"` directives or eslint-disabled `useEffect` form-reset
blocks to compensate for staying mounted.

#### Scenario: a dialog reopens with a different seed

- **WHEN** an edit dialog closes and reopens for a different entity
- **THEN** the form content remounts with the new seed values
- **AND** no effect-based reset runs
