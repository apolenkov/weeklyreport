## ADDED Requirements

### Requirement: Malformed feedback list URL is rejected as invalid input

Authenticated GET /feedback MUST reject a nonempty URL filter that cannot be parsed with the existing relative-path policy as 400 invalid_request before repository access. Empty/absent and non-string filter behavior, focus context, role/product scope and no-store MUST remain unchanged. Unexpected server faults MUST remain 500.

#### Scenario: A malformed host is supplied as URL filter

- **WHEN** an authenticated list request supplies http://[ as its URL query
- **THEN** it receives 400 invalid_request with no persistence access
- **AND** the response remains no-store

#### Scenario: Relative and absolute filters retain focus

- **WHEN** a valid relative or absolute report URL carries legacy feedback focus
- **THEN** the list retains its pathname scope and focus identifier
- **AND** an unexpected repository failure remains a server error
