## ADDED Requirements

### Requirement: Seed restoration clears omitted pause metadata

The advanced seed `upsertItem` MUST explicitly clear an omitted pausedReason on restore rather than preserve an earlier database value. It MUST preserve supplied valid paused reasons and item identity; the existing canonical schema and database invariant MUST continue to reject invalid paused or non-paused tuples.

#### Scenario: Seed restores a legally paused item

- **WHEN** a deterministic seed rerun restores that item to planned, in_progress, postponed or done without supplying a reason
- **THEN** its persisted pausedReason is null and its identity is unchanged

#### Scenario: Supplied paused reason survives

- **WHEN** the writer supplies a valid paused tuple with a reason
- **THEN** the reason is preserved
