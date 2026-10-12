## MODIFIED Requirements

### Requirement: Editable lead sections source dialog lifecycle from the shared hook

Every editable lead report section MUST acquire its dialog lifecycle
from the shared `useEditableListDialog` hook in `apps/web/src` —
this covers current week, next week, risks, decisions, and any later
addition. The hook owns:
dialog open/edit/close state, the add-signal open effect with read-only ref
semantics, `openSeq` keying, and pending-delete
confirmation. The hook MUST NOT open a dialog from a stale non-zero
add signal across read-only transitions (readOnly-ref semantics);
the add-signal counter itself is an external prop the hook cannot
reset — resetting the counters on view-state transitions remains the
form owner's duty per `lead-report-controls-integrity`.
Section-specific save mapping stays in caller-side `onSave`/`onChange`
wrappers, while an optional `seedProductId` remains an explicit hook input; a
section MUST NOT re-implement the lifecycle locally.

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
  handling makes the no-reopen guarantee uniform across sections

#### Scenario: Pending risk deletion rechecks current read-only state

- **WHEN** a pending risk deletion is confirmed after the section becomes read-only
- **THEN** the local list and its owner callback stay unchanged and Cancel remains available
