## ADDED Requirements

### Requirement: Prior outcome resolution MUST coordinate source locks before writes

Resolve MUST acquire the selected source and freshness locks before mutating the
target section, item or receipt. Concurrent submitted-source revocation MUST
produce a serial result without a circular wait caused by the outcome's version
write. Early stale-version rejection, transactional compare-and-set and replay
semantics MUST remain intact.

#### Scenario: Submitted-source revocation overlaps prior-plan resolution

- **WHEN** Resolve and revocation concurrently use the same submitted source
- **THEN** if Resolve acquires the source first, it materializes the outcome before revocation
- **AND** if revocation acquires the source first, Resolve rejects the unavailable source without target changes
- **AND** neither ordering produces a database deadlock between those operations
