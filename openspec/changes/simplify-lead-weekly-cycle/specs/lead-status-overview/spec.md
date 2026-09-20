# Spec Delta

## ADDED Requirements

### Requirement: Overview MUST expose one primary progress interaction per active item

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns and the canonical item editor, while each editable Current or Next item exposes one primary progress/status interaction. It MUST NOT present separate Plan, Confirm, Update status, or week-arrow controls on the primary layer. Updating an unconfirmed carried item through the canonical status/update interaction MUST clear its unconfirmed marker; it MUST NOT require a separate Confirm action. Edit details and rare week movement MAY remain inside one secondary overflow. Restore and explicit historical replanning MAY appear only when applicable. Previously planned content MUST remain read-only.

#### Scenario: an unconfirmed carried item is shown

- **WHEN** Overview renders a carried Current item that the lead has not updated in the selected week
- **THEN** it visibly states that the item is continued or planned but not updated this week
- **AND** one primary progress interaction lets the lead update its current status without a separate Confirm action

#### Scenario: an ordinary active item is shown

- **WHEN** Overview renders an editable Current or Next item with no restore or historical-replan state
- **THEN** it exposes one progress/status interaction and at most one separate Edit action
- **AND** it does not expose Plan, Confirm, Update status, or arrow controls as competing primary actions

#### Scenario: prior week remains read-only

- **WHEN** Overview renders Previously planned content
- **THEN** no edit, move, confirm, or status mutation control is available in that column
- **AND** its text, outcome, and lineage remain visible

#### Scenario: keyboard operation preserves context

- **WHEN** the lead operates the progress interaction or cancels the canonical editor with a keyboard
- **THEN** focus returns to the triggering item control or the Overview heading
- **AND** the three-column lineage remains visible without document-level horizontal overflow
