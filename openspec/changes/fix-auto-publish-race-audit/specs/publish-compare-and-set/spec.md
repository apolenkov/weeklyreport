## ADDED Requirements

### Requirement: Auto-publish outcomes distinguish no-write idempotency from a real write

`PublicationService.publishAuto` MUST report a `published: true` outcome that
lets its caller distinguish two cases: (a) the report was already
`status === "published"` when read, so no write occurred, versus (b) this
call performed the guarded write that transitioned the report to published.
`AutoPublisherScheduler.runOnce` MUST use that distinction to suppress its
audit log (`auditLogger.periodAutoPublish`), its info log line, and the
missing-sections count query on case (a), so a manual publish that races
ahead of the scheduler is never recorded as an auto-publish audit event.

#### Scenario: Idempotent already-published outcome is not audited

- **GIVEN** a report that is already `status === "published"` when
  `publishAuto` reads it (a manual publish won the race)
- **WHEN** `publishAuto` returns its idempotent outcome
- **THEN** the scheduler does not call `auditLogger.periodAutoPublish`
- **AND** the scheduler does not log an `auto-publish period=...` line
- **AND** the scheduler does not query the missing-sections count
- **AND** the report's id is excluded from the scheduler's `publishedIds`.

#### Scenario: A real auto-publish write is still audited

- **GIVEN** a draft report whose deadline plus grace period has passed
- **WHEN** `publishAuto` performs the guarded compare-and-set write and it
  succeeds
- **THEN** the scheduler calls `auditLogger.periodAutoPublish` exactly once
  for that report
- **AND** the report's id appears in the scheduler's `publishedIds`.

#### Scenario: The archived-after-selection branch is unaffected

- **GIVEN** a period archived between candidate selection and the guarded
  write, so `publishAuto` returns `{ published: false }`
- **WHEN** the scheduler processes that outcome
- **THEN** it continues to skip the audit, log, and missing-sections count
  exactly as before this change.
