## ADDED Requirements

### Requirement: A broken stored export invariant is an internal error

The export repository SHALL report a broken stored invariant as an internal
fault that reaches the client as the masked `INTERNAL_SERVER_ERROR`, never as
`NOT_FOUND`. It covers:

- a job snapshot whose `reportId` or publication time differs from the job row;
- a generation advance or recovery quarantine whose guarded update misses under
  the row lock.

Missing and caller-masked exports SHALL keep `NOT_FOUND`.

#### Scenario: A job snapshot naming another report

- **GIVEN** an export job whose stored snapshot names a different report
- **WHEN** the job's published report is read for rendering
- **THEN** the call fails with `INTERNAL_SERVER_ERROR` and the message
  "Unexpected error"

#### Scenario: A locked transition that misses its row

- **GIVEN** a locked export row that is not in the state and generation the
  transition expects
- **WHEN** a generation advance or a recovery quarantine runs
- **THEN** the transaction fails with `INTERNAL_SERVER_ERROR` and the row is
  unchanged
