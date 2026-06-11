## MODIFIED Requirements

### Requirement: View-state transitions never open dialogs

A view-state transition MUST NOT open any dialog on the lead report
page — this covers snapshot view via `viewedSnapshotVersion`, read-only
flips, and period switches. Dialogs open only from a direct user action
in the current view. Imperative "open" signals (the four add-signal
counters in `lead-form.tsx`: current-week, next-week, risks, decisions)
MUST NOT be re-interpreted by effects reacting to unrelated prop
transitions, and all four MUST be reset when the surface enters a
read-only view. This applies to every section dialog on the surface:
Add Item, Add Risk, and Add Decision alike.

#### Scenario: returning from a snapshot

- **WHEN** the lead clicks "Back to current" after previously using
  "+ Add Item" in the session
- **THEN** the snapshot banner closes and the editable form renders
- **AND** no Add Item dialog opens

#### Scenario: returning from a snapshot after "+ Add Risk" or "+ Add Decision"

- **WHEN** the lead clicks "+ Add Risk" (or "+ Add Decision"), cancels
  the dialog, views a snapshot version, and clicks "Back to current"
- **THEN** the editable form renders
- **AND** no Risk or Decision create dialog opens
