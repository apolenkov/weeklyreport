## MODIFIED Requirements

### Requirement: Failed batch recovery preserves observed work

The crawler MUST read completed press evidence before fallible recovery actions. It MUST preserve the original batch failure and separate recovery failures. Failed page restoration MUST stop dependent presses and mark coverage incomplete. Unknown request consumption MUST remain unavailable and MUST NOT refund the outstanding reservation. Failure to persist batch evidence MUST return the completed rows with the original storage failure, stop dependent work and mark coverage incomplete without rereading earlier rows as new evidence.

#### Scenario: Restore fails after a completed press

- **WHEN** a batch times out after completing a press and page restoration fails
- **THEN** the completed press and original timeout remain in the result
- **AND** the restoration failure is reported and no dependent press runs

#### Scenario: Recovery storage is unavailable

- **WHEN** completed press evidence cannot be read
- **THEN** the read failure is explicit and coverage remains incomplete
- **AND** the request count is unavailable rather than zero

#### Scenario: Full traversal cannot restore a failed batch

- **WHEN** a full-mode batch fails after a completed press and page restoration fails
- **THEN** the completed timings and logs remain in the page record with error completion
- **AND** no screenshot, dependent control, combination or rebase reads the unknown page

#### Scenario: Initial batch persistence fails

- **WHEN** resetting the current batch storage fails before any observation completes
- **THEN** the failed batch returns no completed rows and reports the storage cause
- **AND** no control is acted on and older stored rows are not reused

#### Scenario: Persistence fails after an observation completes

- **WHEN** persisting a completed row fails
- **THEN** the row and original storage cause remain observable
- **AND** quick and full traversal stop dependent actions with incomplete coverage
- **AND** unknown request consumption is not refunded
