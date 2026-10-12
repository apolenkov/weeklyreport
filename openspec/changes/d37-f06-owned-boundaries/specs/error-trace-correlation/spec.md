## ADDED Requirements

### Requirement: Denied search retains safe domain cause identity

The current search.query denial MUST preserve SearchAuthorizationError as its tRPC cause while retaining the existing FORBIDDEN code/message and fixed category audit. Existing logging MUST retain only safe cause identity/code and MUST NOT emit denied query text or raw stack.

#### Scenario: Current Lead or Viewer scope is denied

- **WHEN** the real SearchService rejects a schema-admitted forbidden scope
- **THEN** request-end logging identifies SearchAuthorizationError
- **AND** stdout/stderr/file/local OTel sink payloads retain no private query text
