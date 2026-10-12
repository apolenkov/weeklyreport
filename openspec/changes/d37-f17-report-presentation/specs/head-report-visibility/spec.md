## ADDED Requirements

### Requirement: Publish confirmation expires with eligibility

The existing publish confirmation intent MUST expire when submission eligibility becomes false. Restoring eligibility MUST NOT reopen confirmation without a fresh activation. The existing confirmation guard and close-before-publish ordering MUST remain.

#### Scenario: Submission eligibility is lost and restored

- **GIVEN** a head opened publish confirmation while publication was eligible
- **WHEN** the submitted count removes eligibility and later restores it
- **THEN** confirmation remains closed until a fresh opener activation
- **AND** losing eligibility emits no publish mutation
