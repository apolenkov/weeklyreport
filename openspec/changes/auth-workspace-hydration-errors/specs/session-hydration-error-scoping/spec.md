## ADDED Requirements

### Requirement: Context construction failures retain request diagnostics

The mounted tRPC HTTP ingress MUST emit one application error log per failed
context construction, with the correlation ID normalized by existing request
middleware, request IP, registered procedure path (or a fixed unknown-path
marker) and safe error code. It MUST NOT log cookies, authorization headers,
inputs, raw error messages, causes or stacks. Fail-closed propagation and the
existing shaped response MUST remain unchanged.

#### Scenario: Hydration fails before the procedure starts

- **GIVEN** a request reaches the mounted tRPC HTTP ingress with a validated request ID
- **AND** a session-resolution dependency fails during context construction
- **WHEN** the HTTP adapter processes the request
- **THEN** the request returns a shaped internal-server-error response
- **AND** a safe error log carries that same request ID and the request IP
- **AND** no procedure executes and no anonymous or development fallback replaces the failure

#### Scenario: A batch shares one failed context

- **WHEN** several batched procedure calls share a failed context construction
- **THEN** the HTTP request emits one context-failure diagnostic
- **AND** every failed call retains its existing shaped error

#### Scenario: An inbound request ID is invalid

- **GIVEN** the inbound request ID exceeds the existing middleware's accepted bounds
- **WHEN** context construction fails
- **THEN** the diagnostic uses the replacement ID echoed by the canonical middleware
- **AND** the original inbound ID is not logged

#### Scenario: An error occurs after context construction

- **WHEN** a procedure fails with a completed context
- **THEN** existing procedure logging owns the failure
- **AND** no context-failure diagnostic duplicates that event

#### Scenario: A client request fails before context construction

- **WHEN** the HTTP adapter rejects request metadata before calling the context factory
- **THEN** its existing client-error response is retained
- **AND** no context-construction failure is logged

#### Scenario: Input parsing or the body limit rejects a request

- **WHEN** the adapter returns its existing malformed-input or payload-too-large response
- **AND** context construction did not fail
- **THEN** no context-construction failure is logged

#### Scenario: A valid context reaches the existing authentication query

- **GIVEN** session hydration succeeds
- **WHEN** the HTTP client requests `auth.me`
- **THEN** the request returns the existing session representation
- **AND** no context-failure event is logged

#### Scenario: No identity follows the existing anonymous policy

- **GIVEN** no authentication cookie is supplied and development authentication is disabled
- **WHEN** the HTTP client requests `auth.me`
- **THEN** the request succeeds with a null session
- **AND** no context-failure event is logged
