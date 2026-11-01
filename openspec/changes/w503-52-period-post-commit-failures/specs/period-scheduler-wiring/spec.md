## MODIFIED Requirements

### Requirement: Scheduled Period Transitions Emit Real Audit Events

Every machine-driven period transition MUST emit its audit event to the
production AppLogger-backed `AuditLogger` sink — the three `period.auto-*`
events (`period.auto-create`, `period.auto-publish`,
`period.auto-archive`). The schedulers
(`PeriodCreatorScheduler`, `AutoPublisherScheduler`, `AutoArchiverScheduler`)
MUST NOT substitute a null-object audit logger in production, so the
compliance trail for automated lifecycle changes is never silently empty.
An audit emit that throws after the archive transaction has committed MUST NOT
report the archived period as failed or drop it from the tick outcome; the lost
report is logged, because the committed archive is the authoritative outcome.

#### Scenario: Auto-create writes a real audit line

- **WHEN** `PeriodCreatorScheduler.runOnce` mints a new period in a
  production-wired container
- **THEN** the `AuditLogger.periodAutoCreate` call reaches the AppLogger
  sink (an observable `audit` log entry), not `createNullAuditLogger()`

#### Scenario: Auto-publish writes a real audit line

- **WHEN** `AutoPublisherScheduler.runOnce` publishes a due draft period
- **THEN** the `AuditLogger.periodAutoPublish` call reaches the AppLogger
  sink with the period id and missing-section count
- **AND** concurrent scheduler publication of a newer period and Head reopen of an earlier period MAY resolve as the legal serial order reopen then auto-publish.

#### Scenario: Auto-archive writes a real audit line

- **WHEN** `AutoArchiverScheduler.runOnce` archives a period past its
  retention cutoff
- **THEN** the `AuditLogger.periodAutoArchive` call reaches the AppLogger
  sink with the period id

#### Scenario: Publication commits before an unrelated count read becomes unavailable

- **WHEN** auto publication returns a committed report with draft sections
- **THEN** the scheduler records success and audits the count of draft sections from that returned report without an additional post-commit count read
- **AND** skipped/no-write outcomes remain unaudited

#### Scenario: A throwing audit sink keeps a committed archive archived

- **WHEN** `AutoArchiverScheduler.runOnce` has committed the archive of a
  period
- **AND** the `AuditLogger.periodAutoArchive` call throws
- **THEN** the period is reported in `periodIds`
- **AND** it is not reported in `failures`
