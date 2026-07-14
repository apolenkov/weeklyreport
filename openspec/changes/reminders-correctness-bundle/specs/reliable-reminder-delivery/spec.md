## ADDED Requirements

### Requirement: `dispatchPending` gates on the DB-resolved current editable report

The `dispatchPending` procedure MUST resolve the current editable report id
from the database (`weeklyReportService.getCurrentEditableId()`) and compare
the caller-supplied report id against that value. It MUST NOT rely on
`ctx.session.activeReportId`, a value computed once at login and baked into
the JWT, because a period rollover between login and the request leaves that
value stale.

#### Scenario: A legitimate Remind succeeds after a period rollover

- **GIVEN** a head logged in before a period rollover, whose JWT still carries
  the previous period's report id as `activeReportId`
- **WHEN** the head calls `dispatchPending` for the new, now-current editable
  report
- **THEN** the gate compares against the DB-resolved current editable report,
  not the stale session claim
- **AND** the call succeeds

#### Scenario: A request for a non-current report is still rejected

- **GIVEN** a report id that is not the current editable report
- **WHEN** `dispatchPending` is called with that report id
- **THEN** the procedure throws `FORBIDDEN "report-not-active"`

### Requirement: Reminder email payloads never surface a raw report id as a period label

The legacy (no-`kind`) reminder queue payload's `reportPeriod` field MUST
carry a human-readable period label derived from the rule's period bounds. It
MUST NOT carry the raw report UUID.

#### Scenario: A manually-triggered legacy reminder email shows a period label

- **GIVEN** a reminder rule dispatched through the legacy (no-`kind`) payload
  branch
- **WHEN** the queue payload is built
- **THEN** `reportPeriod` is a formatted period label
- **AND** it is not the rule's raw `reportId`

### Requirement: Admin execution-history pagination does not truncate past a fixed row count

`listExecutions` MUST page reminder executions at the database level. A
rule's execution history MUST remain fully walkable via cursor pagination
regardless of how many executions have accumulated; pagination MUST NOT
silently stop because an in-memory slice ran out of rows.

#### Scenario: Execution history beyond 100 rows is still reachable

- **GIVEN** a reminder rule with more than 100 recorded executions
- **WHEN** an admin pages through `listExecutions` using the returned cursor
  repeatedly
- **THEN** every execution row is eventually returned
- **AND** `nextCursor` becomes `null` only after the true last row, not after
  a fixed 100-row slice
