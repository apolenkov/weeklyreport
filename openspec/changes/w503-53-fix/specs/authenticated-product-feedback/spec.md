## ADDED Requirements

### Requirement: Feedback storage mapping MUST validate domain enums

The adapter MUST check a stored feedback row's `type` and `status` against the
shared feedback enums before it returns the row as a domain record. A value
outside those enums MUST NOT be passed on as a trusted value.

#### Scenario: Database contains an out-of-enum feedback type

- **WHEN** a stored feedback row has a `type` that is not a shared feedback type
- **THEN** the repository throws `FeedbackInvalidStatusError`
- **AND** the error message names the row ID

#### Scenario: Database contains historical or corrupted out-of-enum feedback status

- **WHEN** a stored feedback row has a `status` that is not a shared feedback status
- **THEN** the repository throws `FeedbackInvalidStatusError`
- **AND** the error message names the row ID

#### Scenario: Database contains valid feedback enums

- **WHEN** a stored feedback row has a `type` and a `status` from the shared enums
- **THEN** the repository returns the mapped record with those values unchanged
