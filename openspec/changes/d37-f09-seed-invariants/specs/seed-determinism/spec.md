## ADDED Requirements

### Requirement: Advanced ID fields retain valid existing bytes

Advanced itemId, projectStatusId and stageAssignmentId MUST use fixed-width hexadecimal fields, retain existing valid UUID bytes and map admitted tuples injectively to valid UUIDs. Their physical fields MUST reject negative, noninteger or out-of-capacity input. Encoding capacity MUST NOT expand seed actor or stage workflow policy.

#### Scenario: A sequence or catalogue index reaches double digits

- **WHEN** an item/product sequence reaches10 or assignment product index reaches16
- **THEN** the exported formatter returns a valid distinct UUID

#### Scenario: A previously valid tuple is formatted

- **WHEN** the existing single-digit item/product tuple or single-hex assignment product tuple is used
- **THEN** its UUID bytes remain unchanged
