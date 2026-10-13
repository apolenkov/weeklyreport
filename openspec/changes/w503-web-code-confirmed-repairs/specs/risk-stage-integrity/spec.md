## ADDED Requirements

### Requirement: Decision stage validation follows the current parent

The Decision edit dialog MUST clear a prior stage-selection error when the lead changes its parent. Required-stage validation MUST continue to apply to the current product, including implicit selection of its sole owned stage.

#### Scenario: A singleton-stage product replaces an invalid multi-stage selection

- **GIVEN** saving a decision on a multi-stage product with no selected stage displayed a stage error
- **WHEN** the lead selects an activity and then a product with exactly one owned stage
- **THEN** the sole stage is applied automatically
- **AND** the stage selector no longer displays the prior error or invalid state before another save
