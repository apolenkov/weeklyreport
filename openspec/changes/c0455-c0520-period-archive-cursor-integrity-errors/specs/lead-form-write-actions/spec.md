## ADDED Requirements

### Requirement: An outcome source without a durable identity is an internal error

An item outcome command SHALL fail with the masked `INTERNAL_SERVER_ERROR`, not
`NOT_FOUND`, when the resolved source item has no `stableId`. It SHALL write
neither the item nor an outcome event. A missing or unavailable source SHALL
keep its existing not-found response.

#### Scenario: A source item without an identity

- **GIVEN** an outcome command whose resolved source item has no `stableId`
- **WHEN** the command runs
- **THEN** it fails with `INTERNAL_SERVER_ERROR` and the message
  "Unexpected error"
- **AND** no item or outcome event is written
