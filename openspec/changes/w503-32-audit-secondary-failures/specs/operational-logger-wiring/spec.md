## ADDED Requirements

### Requirement: Audit reporting failures MUST NOT change a mutation outcome

A failure of the audit log stream, of the audit drop metric or of the error log
written when a durable audit row is dropped MUST NOT change the result of the
mutation that was audited.

#### Scenario: the audit log stream throws

- **WHEN** a mutation succeeds and the audit log stream throws while recording it
- **THEN** the caller receives the mutation's own result

#### Scenario: reporting a dropped audit row fails

- **WHEN** a mutation succeeds, the durable audit write fails, and the drop metric or the error logger throws
- **THEN** the caller receives the mutation's own result

#### Scenario: the durable row is attempted independently

- **WHEN** the audit log stream throws
- **THEN** the durable audit row is still attempted
- **AND** when the audit log fails to report a lost record, one stderr line names the procedure and the lost sink

#### Scenario: a failed mutation keeps its own error

- **WHEN** a mutation fails with its own error and the audit sinks throw
- **THEN** the caller receives the mutation's original error code
