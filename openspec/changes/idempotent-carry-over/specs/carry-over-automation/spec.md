## ADDED Requirements

### Requirement: Concurrent carry-over executions resolve to one race-safe write

The carry-over write transaction MUST resolve two racing executions for the
same `(sourceReportId, targetReportId)` pair to a single race-safe write:
when the losing transaction's existence check finds a `CarryOverExecution`
row the winner already committed, it MUST return the winner's already-recorded
execution and records instead of attempting to insert records against an
execution id that was never committed. The write transaction MUST also
re-validate target-period editability (`periodStatus` is `open` or
`reopened`, and not `archived`) immediately before writing, not only from a
check performed before the transaction opened, so a period that transitions
to `published` or `archived` in the window between that earlier check and
the transaction's write is rejected rather than written into.

#### Scenario: the losing transaction returns the winner's rows

- **WHEN** two carry-over executions for the same source and target report
  race, and the second transaction's existence check finds a
  `CarryOverExecution` row the first transaction already committed
- **THEN** the second transaction does not attempt to insert
  `CarryOverRecord` rows against its own uncommitted execution id
- **AND** it returns the first transaction's already-recorded execution and
  records

#### Scenario: a period that stops being editable mid-race is rejected

- **WHEN** a carry-over transaction re-reads the target report's
  `periodStatus`/`archived` immediately before writing, and the period has
  become `published` or `archived` since the pre-transaction editability
  check
- **THEN** the transaction aborts without writing any execution, record, or
  carried item/decision row
- **AND** the caller receives a conflict error rather than a partially
  written state
