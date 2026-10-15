## ADDED Requirements

### Requirement: Snapshot restore reports a unique identity collision as a conflict

When a unique constraint rejects a row that snapshot restore writes, because a
live row already holds that identity (for example one a concurrent targeted
save created first), restore MUST roll back completely and fail with the
snapshot conflict error (`CONFLICT`). Any other restore failure MUST propagate
unchanged.

#### Scenario: A targeted save creates a snapshot identity first

- **GIVEN** a snapshot that contains a reporting group absent from the database
- **AND** an administrator saves a reporting group with the same id before the restore inserts it
- **WHEN** the restore insert hits the unique constraint
- **THEN** restore fails with `CONFLICT`
- **AND** none of the snapshot is written
