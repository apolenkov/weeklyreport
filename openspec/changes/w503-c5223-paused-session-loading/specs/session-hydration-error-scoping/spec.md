## ADDED Requirements

### Requirement: The web client never shows an unresolved session as anonymous

The web session state MUST report loading while `auth.me` has not resolved,
including a pending query whose retry is paused because the browser is offline
or the tab is in the background. Only a resolved `null` session MAY be exposed
as unauthenticated. A failed `auth.me` MUST keep rendering the session error
with its retry action instead of children.

#### Scenario: Retry after a failed first auth.me is paused

- **WHEN** the first `auth.me` request fails and the browser goes offline before the retry
- **THEN** `useSession()` reports `isLoading: true` and `isAuthenticated: false` with no user
- **AND** no consumer receives a resolved anonymous session

#### Scenario: auth.me resolves with no session

- **WHEN** `auth.me` resolves with `null`
- **THEN** `useSession()` reports `isLoading: false` and `isAuthenticated: false`
