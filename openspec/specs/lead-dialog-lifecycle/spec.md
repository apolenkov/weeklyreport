## Purpose

The four editable lead report sections (current week, next week, risks, and
decisions) source their dialog lifecycle from the shared
`useEditableListDialog` hook, and the edit dialogs use a mount/unmount shell
pattern. This capability governs the shared structure that
keeps add signals, read-only transitions, deletion confirmation, and form resets
consistent.

## Requirements

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

### Requirement: Edit dialogs use the mount/unmount shell pattern

The lead edit dialogs MUST use the mount/unmount shell pattern:
the outer dialog component returns `null` when `!open` and mounts a
`*DialogContent` component whose `useState` initializers seed from
props at mount, so reopening a dialog remounts fresh state
structurally. The canonical reference is `item-edit-dialog.tsx`; the item,
risk, and decision dialogs MUST all follow that structure. The dialogs MUST NOT
carry `"use no memo"` directives or eslint-disabled
`useEffect` form-reset blocks to compensate for staying mounted.

#### Scenario: a dialog reopens with a different seed

- **WHEN** an edit dialog closes and reopens for a different entity
- **THEN** the form content remounts with the new seed values
- **AND** no effect-based reset runs

### Requirement: Quick add opens one editor in every public lead view

An editable Lead report MUST route each shared quick-add command to exactly one
canonical create editor in both Overview and Slides. Current and Next open the
Item editor; Risk and Blocker open the Risk editor; Decision opens the Decision
editor. Blocker MUST retain its product prefill and blocked severity. A dialog
host mounted by switching views MUST baseline existing command counters and
MUST NOT consume a command issued in the previously mounted view.

#### Scenario: Slides routes every quick-add kind

- **GIVEN** an editable Lead report in Slides
- **WHEN** the lead selects Current, Next, Risk, Blocker or Decision from `+ Add`
- **THEN** the matching canonical editor opens exactly once
- **AND** Blocker opens Risk with the expected product and blocked severity

#### Scenario: switching views does not replay an add command

- **GIVEN** a quick-add command was consumed in Overview or Slides
- **WHEN** the lead switches to the other public view
- **THEN** the newly mounted dialog host remains closed
- **AND** only a later command increment can open an editor there

### Requirement: Quick-add dialogs restore focus to their local trigger

Before dispatching a quick-add command, the picker MUST establish its own
still-mounted `+ Add` button as the dialog opener. Closing the resulting Current,
Next, Risk, Blocker or Decision editor with Escape or Cancel MUST restore focus
to that local trigger even though the selected popup option was removed.

#### Scenario: a picker-opened editor closes

- **WHEN** the lead chooses any quick-add kind and closes its editor with Escape or Cancel
- **THEN** keyboard focus returns to the same `+ Add` button that opened the picker

### Requirement: Weekly add signals accept an activity seed

The shared dialog lifecycle MUST support an optional activity seed alongside its
product seed. Weekly sections MUST prefer their existing product default and
use their first attached activity only when no product is available. A
seed-required signal MUST NOT open without either parent. Existing read-only
and stale mount-signal guards MUST remain in effect.

#### Scenario: An activity-only weekly section receives a new add signal

- **GIVEN** an editable current or next week section with only an attached activity
- **WHEN** its add signal advances after mount
- **THEN** the item dialog opens with that activity selected and no product selected

#### Scenario: A mixed section preserves the product default

- **GIVEN** an editable weekly section with products and attached activities
- **WHEN** its add signal advances
- **THEN** the existing first product remains the selected default

#### Scenario: An unavailable parent cannot satisfy the signal guard

- **GIVEN** a weekly section with no product or activity seed
- **WHEN** its add signal advances
- **THEN** its item dialog remains closed
