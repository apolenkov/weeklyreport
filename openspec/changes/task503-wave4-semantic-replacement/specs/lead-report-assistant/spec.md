## ADDED Requirements

### Requirement: Concurrent requests reuse active semantic work

The semantic indexing enqueue boundary MUST reuse work with the same complete
semantic identity when terminal-job replacement collides with a worker already
processing that identity. Removal failures without an active replacement MUST
remain technical errors.

#### Scenario: Another request's replacement is already processing

- **WHEN** terminal-job removal rejects because another request's same-identity
  replacement is locked by a worker
- **AND** the current job is active
- **THEN** enqueue succeeds without replacing the worker's job
- **AND** semantic retrieval continues to use the pending-index outcome until
  the requested embeddings are available

#### Scenario: Removal fails without an active replacement

- **WHEN** terminal-job removal rejects and no active same-identity replacement
  is observed
- **THEN** enqueue rejects with a technical error
- **AND** it does not claim successful indexing
