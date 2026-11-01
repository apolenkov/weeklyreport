## ADDED Requirements

### Requirement: Stored feedback type and status MUST stay within the shared enums

The database MUST reject a `ProductFeedback` row whose `type` is not one of
`FEEDBACK_TYPES` or whose `status` is not one of `FEEDBACK_STATUSES`. The
constraints MUST be added by a forward-only migration that does not update or
delete rows, and a contract test MUST keep the SQL value lists equal to the
shared enums.

#### Scenario: A write outside the application stores an unknown status

- **WHEN** any client inserts or updates a `ProductFeedback` row with a status
  outside `FEEDBACK_STATUSES`
- **THEN** the database rejects the write with a check violation

#### Scenario: The shared enums change

- **WHEN** a value is added to or removed from `FEEDBACK_TYPES` or
  `FEEDBACK_STATUSES`
- **THEN** the migration contract test fails until a new migration aligns the
  database constraint
