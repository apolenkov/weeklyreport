# api-logger-transport Specification

## Purpose

Isolate `AppLogger` log calls from standard-stream and OTel transport
failures so a failed write or emit never throws into its caller.

## Requirements

### Requirement: A log call never throws into its caller

`AppLogger` log methods MUST NOT throw because a standard stream write or the OTel log emit failed. A failed stdout or stderr write MUST retry the same formatted entry on the other standard stream and MUST report the failure there. A failed OTel emit MUST be reported on stderr and MUST NOT change the stdout entry.

#### Scenario: A failing stdout write falls back to stderr

- **WHEN** `process.stdout.write` throws during an `info` call
- **THEN** the call returns normally and the formatted entry is written to stderr

#### Scenario: A failing stderr write falls back to stdout

- **WHEN** `process.stderr.write` throws during an `error` call
- **THEN** the call returns normally and the formatted entry is written to stdout

#### Scenario: A failing OTel emit does not affect the log call

- **WHEN** the OTel log emit throws during an `info` call
- **THEN** the call returns normally, the stdout entry is written once, and stderr reports the OTel failure
