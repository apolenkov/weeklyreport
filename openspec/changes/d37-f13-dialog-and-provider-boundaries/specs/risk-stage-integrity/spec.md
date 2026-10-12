## MODIFIED Requirements

### Requirement: Item and risk stage errors follow the current parent

Changing the parent in an item or risk editor MUST clear the stage-validation
error produced for the previous parent and reset its selected stages. It MUST
preserve unrelated prose errors and unsaved text. The next save MUST validate
the currently selected parent under the existing product/activity rules.

#### Scenario: A single-stage product replaces a failed multi-stage selection

- **WHEN** an item or risk save fails because no stage was selected for a
  multi-stage product and the user switches to a single-stage product
- **THEN** the old stage error disappears and the new stage is applied automatically
- **AND** saving valid prose emits the new product and its single stage

#### Scenario: Parent changes preserve unrelated validation

- **WHEN** an item or risk has both prose and stage errors and its parent changes
- **THEN** only the previous parent's stage error is cleared
- **AND** unrelated prose errors remain until their fields are corrected

#### Scenario: Returning to a multi-stage product validates its new selection

- **WHEN** the user switches back to a multi-stage product and saves without
  selecting a stage
- **THEN** saving is rejected with the current missing-stage error

#### Scenario: Unresolved parents remain recoverable

- **WHEN** an Item or Risk has an unresolved requested parent with valid options
- **THEN** the editor does not classify absence as zero-owned-stage product; saving valid prose reports a parent error without emitting, and selecting a valid parent clears that error under existing stage rules
