## Purpose

The four editable lead report sections (current week, next week, risks,
decisions) each hand-copied the same dialog lifecycle: a `DialogState`
union, an add-signal open effect, pending-delete confirmation, and
save/cancel closing. The copies drifted — two of them missed the D1
readOnly-ref fix and violated `lead-report-controls-integrity` ("a
view-state transition MUST NOT open any dialog"). This capability pins
the structural invariant introduced by `refactor-lead-dialog-lifecycle`:
sections source their dialog lifecycle from the shared
`useEditableListDialog` hook, and the edit dialogs use the D12
mount/unmount shell pattern. Behavior is unchanged — the capability
governs the structure that prevents the defect class from regrowing.

## Requirements

### Requirement: Editable lead sections source dialog lifecycle from the shared hook

Every editable lead report section MUST acquire its dialog lifecycle
from the shared `useEditableListDialog` hook in `apps/web/src` —
this covers current week, next week, risks, decisions, and any later
addition. The hook owns:
dialog open/edit/close state, the add-signal open effect with the D1
readOnly-ref semantics, openSeq keying (D13), and pending-delete
confirmation. The hook MUST NOT open a dialog from a stale non-zero
add signal across read-only transitions (readOnly-ref semantics);
the add-signal counter itself is an external prop the hook cannot
reset — resetting the counters on view-state transitions remains the
form owner's duty per `lead-report-controls-integrity`.
Section-specific behavior
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
- **THEN** no dialog opens in any section — the form owner resets the
  counters per `lead-report-controls-integrity`, and the hook's signal
  handling makes the no-reopen guarantee uniform across sections, so
  the D1 fix can never again reach only a subset of sections

### Requirement: Edit dialogs use the D12 mount/unmount shell pattern

The lead edit dialogs MUST use the D12 mount/unmount shell pattern:
the outer dialog component returns `null` when `!open` and mounts a
`*DialogContent` component whose `useState` initializers seed from
props at mount, so reopening a dialog remounts fresh state
structurally. There is deliberately no generic exported `DialogShell`
component — a generic JSX wrapper evaluates children eagerly and
defeats the mount/unmount reset — so each dialog replicates the
pattern locally. The canonical reference is `item-edit-dialog.tsx`,
which already complies and is not edited; this change converts
`risk-edit-dialog.tsx` and `decision-edit-dialog.tsx`. The dialogs
MUST NOT carry `"use no memo"` directives or eslint-disabled
`useEffect` form-reset blocks to compensate for staying mounted.

#### Scenario: a dialog reopens with a different seed

- **WHEN** an edit dialog closes and reopens for a different entity
- **THEN** the form content remounts with the new seed values
- **AND** no effect-based reset runs
