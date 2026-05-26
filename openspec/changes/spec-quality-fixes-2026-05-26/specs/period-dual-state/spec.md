## ADDED Requirements

### Requirement: Atomicity Must Be Covered by an Automated Test

At least one automated integration test MUST assert that the dual-state
write invariant holds. The test MUST verify that a rolled-back transaction
leaves neither `periodState` nor the legacy period tuple in a partially
updated state.

#### Scenario: Transaction rolls back mid-write

- **WHEN** a writer begins a dual-state update and the Prisma transaction rolls back before both fields are committed
- **THEN** neither `periodState` nor the legacy period tuple reflects the new value
- **AND** the `Report` row remains in its prior consistent state
