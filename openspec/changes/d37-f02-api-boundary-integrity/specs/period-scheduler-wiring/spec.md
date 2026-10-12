# Spec Delta

## MODIFIED Requirements

### Requirement: Scheduled Period Transitions Emit Real Audit Events

Every machine-driven period transition MUST emit its audit event to the
production AppLogger-backed `AuditLogger` sink — the three `period.auto-*`
events (`period.auto-create`, `period.auto-publish`,
`period.auto-archive`). The schedulers
(`PeriodCreatorScheduler`, `AutoPublisherScheduler`, `AutoArchiverScheduler`)
MUST NOT substitute a null-object audit logger in production, so the
compliance trail for automated lifecycle changes is never silently empty.

#### Scenario: Auto-create writes a real audit line

- **WHEN** `PeriodCreatorScheduler.runOnce` mints a new period in a
  production-wired container
- **THEN** the `AuditLogger.periodAutoCreate` call reaches the AppLogger
  sink (an observable `audit` log entry), not `createNullAuditLogger()`

#### Scenario: Auto-publish writes a real audit line

- **WHEN** `AutoPublisherScheduler.runOnce` publishes a due draft period
- **THEN** the `AuditLogger.periodAutoPublish` call reaches the AppLogger
  sink with the period id and missing-section count

#### Scenario: Auto-archive writes a real audit line

- **WHEN** `AutoArchiverScheduler.runOnce` archives a period past its
  retention cutoff
- **THEN** the `AuditLogger.periodAutoArchive` call reaches the AppLogger
  sink with the period id

#### Scenario: Publication commits before an unrelated count read becomes unavailable

- **WHEN** auto publication returns a committed report with draft sections
- **THEN** the scheduler records success and audits the count of draft sections from that returned report without an additional post-commit count read
- **AND** skipped/no-write outcomes remain unaudited

### Requirement: Current-period lookup selects only a coupled live tuple

The login-time and scheduler current-period factory MUST select an existing
report only when companion publication status is draft, archived is false, canonical state is
scheduled or open, and all lifecycle fields form a valid tuple for the requested
boundary. The factory MUST first return the exact live scheduling boundary when
one exists; when no exact boundary exists, it MUST return the single valid live
`scheduled` or `open` manual range containing the anchor date rather than
creating an overlapping canonical week. A live range that only partially
overlaps the canonical week and does not contain the anchor MUST still surface
the typed overlap error from the database write path. If a manual range commits
after both lookups but before canonical creation, the overlap-error recovery
MUST re-read the exact boundary and then the containing range before returning
the typed conflict.

#### Scenario: Archived draft occupies the requested boundary

- **WHEN** an archived row retains draft publication status and its dates contain the requested instant
- **THEN** current-period lookup excludes that row and finds or creates the valid live row

#### Scenario: Contradictory row occupies the requested boundary

- **WHEN** a row matches the date boundary but its canonical and companion lifecycle fields disagree
- **THEN** lookup fails with a typed integrity error and MUST NOT return or overwrite the row

#### Scenario: Manual range contains the login anchor

- **WHEN** no exact scheduler boundary exists and one valid live manual range
  contains the anchor date
- **THEN** the factory returns that range without creating a new report

#### Scenario: Manual range wins during canonical creation

- **WHEN** both initial lookups find no row, a live manual range containing the
  anchor commits, and canonical creation then hits the named overlap constraint
- **THEN** recovery re-reads the exact boundary and containing range
- **AND** the factory returns the committed manual range without creating a
  second report

#### Scenario: Partial overlap does not contain the anchor

- **WHEN** no exact boundary exists and a live manual range overlaps the
  canonical week but ends before the anchor date
- **THEN** canonical creation fails with the typed period-overlap error

#### Scenario: Valid scheduled or open row exists

- **WHEN** exactly one complete live tuple matches the requested boundary
- **THEN** the factory returns that row without creating a duplicate

#### Scenario: A valid reopened publication matches the boundary

- **WHEN** a schema-valid reopened publication matches the exact or containing lookup range
- **THEN** it is excluded from draft current-period lookup
- **AND** invalid tuples still fail integrity validation and named overlap conflicts retain their current policy
