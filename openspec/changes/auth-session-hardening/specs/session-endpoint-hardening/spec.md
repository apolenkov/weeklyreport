## ADDED Requirements

### Requirement: The logout endpoint rejects cross-origin requests

`POST /auth/logout` MUST reject a request whose `Origin` header is present
and does not match the configured `FRONTEND_URL`, responding `403
Forbidden` without clearing the session cookie or emitting a logout audit
entry. A request with no `Origin` header (same-origin form submission,
server-to-server call) MUST pass through unchanged.

#### Scenario: A cross-site auto-submit is rejected

- **GIVEN** a `POST /auth/logout` request whose `Origin` header does not
  match `FRONTEND_URL`
- **WHEN** the logout handler runs
- **THEN** it responds `403 Forbidden`
- **AND** it does not clear the session cookie
- **AND** it does not emit a logout audit entry

#### Scenario: A same-origin logout still succeeds

- **GIVEN** a `POST /auth/logout` request whose `Origin` header matches
  `FRONTEND_URL`, or has no `Origin` header at all
- **WHEN** the logout handler runs
- **THEN** it clears the session cookie and redirects as before

### Requirement: The cache-revalidation endpoint requires the admin role

`POST /api/revalidate-org` MUST reject a session whose role is not
`admin` with `403 Forbidden`, evaluated after the existing session-presence
check and before the ISR purge runs.

#### Scenario: A non-admin session is rejected

- **GIVEN** an authenticated session whose role is `lead`, `head`, or
  `viewer`
- **WHEN** that session calls `POST /api/revalidate-org`
- **THEN** the response is `403 Forbidden`
- **AND** `revalidatePath` is not called

#### Scenario: An admin session succeeds

- **GIVEN** an authenticated session whose role is `admin`
- **WHEN** that session calls `POST /api/revalidate-org` with a matching
  or absent `Origin` header
- **THEN** the response is `{ revalidated: true }`
- **AND** the landing page's ISR cache is purged

### Requirement: The client logout control only redirects after a confirmed logout

The nav-bar logout button MUST navigate to `/` only after the
`POST /auth/logout` request settles with an OK response. A non-OK
response or a network failure MUST leave the visitor on the current page
instead of redirecting as though logout had succeeded.

#### Scenario: A successful logout redirects home

- **GIVEN** a visitor clicks the nav-bar logout button
- **WHEN** `POST /auth/logout` resolves with an OK response
- **THEN** the browser navigates to `/`

#### Scenario: A failed logout does not redirect

- **GIVEN** a visitor clicks the nav-bar logout button
- **WHEN** `POST /auth/logout` resolves with a non-OK response, or the
  request fails outright
- **THEN** the browser does not navigate away
- **AND** the session cookie remains whatever it was before the click
