## ADDED Requirements

### Requirement: Archived Fill fixture attempts independent cleanup and preserves failures

After creating its PostgreSQL pool, `applyArchivedFillFixture` MUST attempt pool
cleanup even if Prisma adapter/client construction, fixture preparation or
client disconnect fails. When a client exists, it MUST attempt client disconnect
independently of pool cleanup. It MUST reject on preparation or cleanup failure.
If cleanup succeeds, it MUST preserve the original thrown value, including
`undefined`. If cleanup also fails, it MUST throw `AggregateError` containing
the original failure first and as `cause`, followed by cleanup failures in
disconnect/pool order. With no preparation failure, it MUST aggregate only
cleanup failures. Existing target guards and fixture contents MUST be preserved.

#### Scenario: Prisma construction fails

- **WHEN** Prisma construction fails after the pool was created
- **THEN** pool cleanup is attempted and the constructor failure is preserved
- **AND** any pool cleanup failure is aggregated with that constructor failure

#### Scenario: Disconnect fails

- **WHEN** disconnect rejects after fixture preparation
- **THEN** pool cleanup is still attempted
- **AND** the fixture rejects with the cleanup errors

#### Scenario: Preparation and both cleanup operations fail

- **WHEN** fixture preparation fails and both disconnect and pool cleanup fail
- **THEN** both cleanup operations are attempted
- **AND** the aggregate retains the original failure as its first entry and cause

#### Scenario: Preparation and cleanup succeed

- **WHEN** fixture preparation and both cleanup operations succeed
- **THEN** the fixture resolves only after both resources have been cleaned up
