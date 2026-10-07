## ADDED Requirements

### Requirement: Failed batch recovery preserves observed work

The crawler MUST read completed press evidence before fallible recovery actions. It MUST preserve the original batch failure and separate recovery failures. Failed page restoration MUST stop dependent presses and mark coverage incomplete. Unknown request consumption MUST remain unavailable and MUST NOT refund the outstanding reservation.

#### Scenario: Restore fails after a completed press

- **WHEN** a batch times out after completing a press and page restoration fails
- **THEN** the completed press and original timeout remain in the result
- **AND** the restoration failure is reported and no dependent press runs

#### Scenario: Recovery storage is unavailable

- **WHEN** completed press evidence cannot be read
- **THEN** the read failure is explicit and coverage remains incomplete
- **AND** the request count is unavailable rather than zero
