# Spec Delta

## ADDED Requirements

### Requirement: The lead report actions stay disabled while an unsaved update is open

While the Lead form has an unsaved update open — the same pending-input
state that disables the Overview item actions — the report header action
group MUST keep every action control, including `Request reopen`,
unavailable. The group MUST show the hint "Save or cancel the open update
before using report actions." next to the actions, and the surface MUST
show the "Unsaved update — save or cancel the open edit" status while the
update is open. Disabling the actions MUST NOT discard the update's
entered data.

#### Scenario: an open update disables the report actions

- **WHEN** the lead opens an unsaved update in the Overview
- **THEN** every report action control, including `Request reopen`, is disabled
- **AND** the hint "Save or cancel the open update before using report actions." is shown next to the actions
- **AND** the "Unsaved update — save or cancel the open edit" status is visible

#### Scenario: saving or cancelling the update restores the report actions

- **WHEN** the lead saves or cancels the open update
- **THEN** the report action controls, including `Request reopen`, are available again
- **AND** the hint and the "Unsaved update — save or cancel the open edit" status are no longer shown

#### Scenario: the entered update data survives while the actions are disabled

- **WHEN** an open update keeps the report actions disabled
- **AND** the lead has entered text into the update
- **THEN** the entered text remains in the open update
