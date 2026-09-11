## ADDED Requirements

### Requirement: Outcome lock waits MUST be bounded by PostgreSQL

Resolve and Restore MUST set a transaction-local PostgreSQL lock timeout of
15 seconds before acquiring outcome locks. A lock timeout MUST roll back the
operation without partial item, version or receipt changes. This bounds each
lock wait; it does not establish a whole-request latency guarantee.

#### Scenario: An outcome waits on a locked report

- **WHEN** another transaction holds a required report lock beyond the lock timeout
- **THEN** the outcome fails while that transaction still holds the lock
- **AND** its stored state remains unchanged
- **AND** the same command can succeed after the blocker releases the lock
