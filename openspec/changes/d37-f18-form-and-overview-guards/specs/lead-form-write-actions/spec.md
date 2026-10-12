## ADDED Requirements

### Requirement: Revoke failure copy uses the shared mutation formatter

A failed revoke mutation MUST format its error through the shared mutation
error formatter with the action-specific "Revoke failed" fallback: recognized
bare transport or raw validation messages MUST be replaced by the action
copy, while curated domain or conflict messages MUST pass through unchanged.
The activation guard, success copy and invalidation behavior MUST remain as
specified.

#### Scenario: A recognized transport failure reaches the revoke handler

- **WHEN** the current activation's revoke rejects with a bare transport error
- **THEN** the toast names the action's failure copy
- **AND** the raw transport message is not shown

#### Scenario: A curated domain failure reaches the revoke handler

- **WHEN** the current activation's revoke rejects with a curated domain or
  conflict message
- **THEN** that message is shown unchanged
