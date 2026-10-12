## MODIFIED Requirements

### Requirement: PDF export tokens are bound to their requester

Every PDF-export token MUST contain a non-empty `requestedBy` user identifier.
The verifier MUST reject tokens that omit the claim, and the worker session MUST
be rebuilt from that requester so export authorization cannot fall back to a
synthetic identity.

#### Scenario: A token without requestedBy is rejected

- WHEN a PDF-export token omits `requestedBy`
- THEN verification fails before a worker session is established

#### Scenario: A current token rebuilds the requester session

- WHEN a valid PDF-export token includes `requestedBy`
- THEN the worker session is resolved from that user and its current access
  state is checked

#### Scenario: A valid token with a denied requester is terminal

- **WHEN** a valid PDF-export token names a missing, inactive or revoked requester
- **THEN** protected tRPC procedures reject the request as unauthenticated
- **AND** no development identity is established even when development authentication is enabled
- **AND** technical access or hydration failures still propagate as server faults
