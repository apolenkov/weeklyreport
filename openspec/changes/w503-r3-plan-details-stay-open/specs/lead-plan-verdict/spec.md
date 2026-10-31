## ADDED Requirements

### Requirement: The composer parent section stays open after choosing a Parent

In the plan outcome composer the "Parent and stages" section MUST open when the
parent is unresolved at open time, and MUST NOT close because a Parent was chosen.
After that it follows the user's own toggling.

#### Scenario: Choosing a Parent reveals the stage choice

- **GIVEN** the composer is open with an unresolved parent and the section expanded
- **WHEN** the lead selects a product Parent
- **THEN** the "Parent and stages" section remains open
- **AND** the stage selection is visible

#### Scenario: Manual collapse is respected

- **GIVEN** the section is open
- **WHEN** the lead collapses it and then changes the Parent
- **THEN** the section stays collapsed
