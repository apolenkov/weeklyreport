## ADDED Requirements

### Requirement: Section writes admit only a proven editable period tuple

`saveDraft` and `submitSection` MUST prove inside their write transaction that the owning report still has a complete consistent editable lifecycle tuple. Open and reopened are the only accepted period statuses; null, missing, deleted, published, archived, or contradictory state MUST fail closed.

#### Scenario: Period status lookup returns null

- **WHEN** either section write path cannot resolve a complete owning report lifecycle tuple
- **THEN** it rejects before deleting or recreating child rows and returns the typed not-found or integrity error

#### Scenario: Period changes while a section write is pending

- **WHEN** archive, publish, reopen, or deletion commits after an application pre-check but before the section mutation
- **THEN** the transaction predicate no longer matches, the entire section mutation rolls back, and a typed stale/lifecycle error is returned

#### Scenario: Reopened period remains editable

- **WHEN** the owning report has one complete reopened tuple throughout the transaction
- **THEN** draft save or submit applies atomically and preserves the period tuple unchanged
