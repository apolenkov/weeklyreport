## ADDED Requirements

### Requirement: The local log file sink recovers after a failed write

When `LOG_DIR` is configured, a logger MUST fail closed at construction if the
directory cannot be created. After a file write fails, the next write from any
logger on that directory, including the shared `APP_LOGGER`, its children and
new loggers, MUST reopen the sink instead of writing into the failed stream. A
reopen failure during a log call MUST NOT throw; it MUST write one line to
stderr, and stdout/stderr MUST still carry the entry. `flush` MUST settle the
current stream's pending writes without reopening it.

#### Scenario: the same logger writes again after the fault clears

- **WHEN** an append to `app.log` failed and the cause is removed
- **THEN** the next entry from the same logger is written to `app.log`

#### Scenario: a child and a new logger reuse the recovered sink

- **WHEN** an append failed and the cause is removed
- **THEN** entries from a child logger and from a new logger on the same
  directory are written to `app.log`

#### Scenario: a failed reopen does not throw from a log call

- **WHEN** the sink must be reopened and its directory cannot be created
- **THEN** the log call returns normally
- **AND** stderr receives one `[logger] file reopen failed` line

#### Scenario: a configured directory that cannot be created fails closed

- **WHEN** a logger is constructed with a `LOG_DIR` that cannot be created
- **THEN** construction throws

### Requirement: The Nest adapter keeps an Error's own stack out of context

The Nest logger adapter MUST NOT record the second argument as `nestContext`
when the first argument is an Error, the second argument is exactly that
Error's `stack`, and no third argument is given. All other call shapes MUST
keep their current mapping.

#### Scenario: the static shutdown-hook form

- **WHEN** Nest logs `Logger.error(err, err.stack)` through the adapter
- **THEN** the entry carries the Error's name and stack
- **AND** the entry has no `nestContext`

#### Scenario: an Error with a context

- **WHEN** the adapter receives `error(err, "Caller")`
- **THEN** `nestContext` is `"Caller"` and the stack is the Error's own
