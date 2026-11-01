# session-hydration-error-scoping Specification

## Purpose

Requires session resolution to map only a token-verification failure to null, letting a transient hydration error propagate rather than silently degrading an authenticated caller to anonymous.

## Requirements

### Requirement: Session resolution only maps a token-verification failure to null

`resolveHumanSession` MUST return `null` only when `deps.verifySessionToken`
throws (an invalid, expired, tampered, or otherwise unverifiable token). An
error raised by `isUserAccessBarred` or by any step of `hydrateSession`
(branding/reporting-group hydration, organization hydration, viewer group
access, section resolution) MUST propagate out of `resolveHumanSession`
rather than being caught and mapped to `null`.

#### Scenario: An invalid token resolves to no session

- **GIVEN** a session token that fails `verifySessionToken`
- **WHEN** `resolveHumanSession` is called with that token
- **THEN** it resolves to `null`

#### Scenario: A transient hydration failure does not resolve to no session

- **GIVEN** a session token that verifies successfully and is not access-barred
- **AND** `hydrateSession` throws (e.g. a transient database error during
  reporting-group or organization hydration)
- **WHEN** `resolveHumanSession` is called with that token
- **THEN** the error propagates out of `resolveHumanSession`
- **AND** it is not mapped to `null`

#### Scenario: An access-bar check failure does not resolve to no session

- **GIVEN** a session token that verifies successfully
- **AND** `isUserAccessBarred` throws (e.g. a transient database error)
- **WHEN** `resolveHumanSession` is called with that token
- **THEN** the error propagates out of `resolveHumanSession`
- **AND** it is not mapped to `null`

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

### Requirement: SessionProvider never reports an unresolved session as anonymous

The `SessionProvider` session state MUST report loading while `auth.me` has not
resolved, including a pending query whose retry is paused because the browser
is offline or the tab is in the background. Only a resolved `null` session MAY
be exposed as unauthenticated. When `auth.me` fails after its retries are
exhausted (query error), the provider MUST keep rendering the session error with
its retry action instead of children.

#### Scenario: Retry after a failed first auth.me is paused

- **WHEN** the first `auth.me` request fails and the browser goes offline before the retry
- **THEN** `useSession()` reports `isLoading: true` and `isAuthenticated: false` with no user
- **AND** no `useSession()` consumer receives a resolved anonymous session

#### Scenario: auth.me resolves with no session

- **WHEN** `auth.me` resolves with `null`
- **THEN** `useSession()` reports `isLoading: false` and `isAuthenticated: false`

#### Scenario: auth.me fails after its retries

- **WHEN** `auth.me` ends in a query error
- **THEN** the provider renders the session error with a retry action instead of children

### Requirement: The Lead section preview waits for an unresolved auth.me

The Lead section preview MUST render the shared weekly-report skeleton while its
own `auth.me` query is pending, including a retry paused offline or in a
background tab, and MUST open the report with the Lead's author id once
`auth.me` resolves.

#### Scenario: Preview retry is paused

- **WHEN** the first `auth.me` request on the preview fails and the browser goes offline before the retry
- **THEN** the preview shows the weekly-report skeleton and does not open the report without an author

#### Scenario: Preview auth.me resolves

- **WHEN** the preview's `auth.me` resolves with the Lead's session
- **THEN** the preview opens the report with the Lead's author id
