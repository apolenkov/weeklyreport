## ADDED Requirements

### Requirement: The Active week control MUST NOT ignore a click after a failed save

While the Overview editor shows a failed save, every Active week radio MUST
either apply the lead's choice or be disabled. An enabled radio MUST NOT ignore
a click. The text the lead typed MUST remain in the editor in both cases.

#### Scenario: a week is chosen after a failed save

- **WHEN** a lead saves an edited item and the save fails
- **AND** the lead clicks the other Active week radio
- **THEN** that radio is selected, or it is disabled
- **AND** the lead's typed text is still in the Description field
