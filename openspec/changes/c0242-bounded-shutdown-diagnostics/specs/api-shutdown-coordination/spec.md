## ADDED Requirements

### Requirement: Terminal diagnostics never delay exit

When the coordinator reports a fatal-deadline timeout or a failed drain, it
MUST write that single line with one synchronous, best-effort write to the
standard-error descriptor owned by the runtime's standard-error stream,
immediately before requesting exit. It MUST NOT wait for a stream flush, a
write callback or any additional timer. A failed write MUST NOT throw out of
the coordinator, change the exit code or prevent the single exit request. When
standard error is a pipe whose reader has stalled, the write MUST NOT keep the
process from requesting exit; this depends on the runtime opening the pipe
non-blocking and is verified by a native check, not by unit tests. Delivery is
best-effort: the line is not guaranteed when the pipe is already full, and its
order relative to earlier queued standard-error output is not guaranteed.

#### Scenario: Timeout line is written before the bounded exit

- **WHEN** the fatal drain remains pending beyond its deadline
- **THEN** the timeout line is written synchronously to standard error
- **AND** exit code 1 is requested exactly once afterwards

#### Scenario: Failed drain line is written before exit

- **WHEN** the resource drain rejects
- **THEN** the failure line is written synchronously to standard error
- **AND** exit code 1 is requested exactly once afterwards

#### Scenario: A failed diagnostic write does not delay exit

- **WHEN** the synchronous write to standard error fails
- **THEN** the coordinator still requests exit code 1 exactly once
- **AND** it neither waits nor schedules another timer

#### Scenario: A stalled standard-error reader does not block exit

- **WHEN** standard error is a pipe that is full and its reader is stalled
- **THEN** the process still exits with code 1 within the fatal deadline plus scheduling slack
- **AND** the diagnostic line may be absent
