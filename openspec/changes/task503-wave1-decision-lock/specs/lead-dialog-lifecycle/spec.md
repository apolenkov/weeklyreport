## ADDED Requirements

### Requirement: Decision deletion respects current published-lineage locks

The decision deletion UI in `DecisionsSection` MUST use current edit permission and published-lineage locks when opening and confirming deletion. A refused confirmation MUST close without changing the decision list. Unlocked editable decisions MUST retain the existing delete and Cancel behavior.

#### Scenario: Published lineage arrives while confirmation is open

- **GIVEN** a lead opens Delete for an unlocked editable decision
- **WHEN** its published-lineage lock arrives before the lead confirms
- **THEN** confirmation leaves the decision list unchanged
- **AND** the confirmation closes

#### Scenario: An unlocked editable decision is confirmed

- **WHEN** a lead confirms deletion of an unlocked editable decision
- **THEN** the decision is removed from the local draft
- **AND** the confirmation closes

#### Scenario: Edit permission changes while confirmation is open

- **GIVEN** a lead opens Delete for an editable decision
- **WHEN** the section becomes read-only before confirmation
- **THEN** confirmation leaves the decision list unchanged
- **AND** the confirmation closes
