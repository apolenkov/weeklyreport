## ADDED Requirements

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
