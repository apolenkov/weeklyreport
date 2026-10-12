## ADDED Requirements

### Requirement: Mandatory reminder recovery dates reject null before coercion

Mandatory reminder fireAt, deadline, scheduledFor, createdAt and updatedAt MUST reject null before date coercion. Valid Date and ISO recovery inputs MUST retain their instants. Nullable sentAt MUST keep its existing lifecycle semantics; explicit epoch dates MUST NOT be rejected by this null guard.

#### Scenario: Invalid reminder persistence timestamp

- **WHEN** a coherent snapshot contains null execution createdAt or updatedAt
- **THEN** the shared snapshot rejects that field before any restore transaction

#### Scenario: Other required reminder date is null

- **WHEN** a rule fireAt/deadline or execution scheduledFor is null
- **THEN** the owning reminder schema rejects null before coercion

#### Scenario: Valid exported reminder dates round-trip

- **WHEN** recovery receives valid Date values or their ISO serialization
- **THEN** the parsed instants remain equal and nullable sentAt remains null
