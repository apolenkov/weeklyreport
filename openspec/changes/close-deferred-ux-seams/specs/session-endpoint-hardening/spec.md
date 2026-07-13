# session-endpoint-hardening (delta)

## MODIFIED Requirements

### Requirement: The client logout control only redirects after a confirmed logout

Every client control that logs the session out MUST navigate away only
after the `POST /auth/logout` request settles with an OK response. A
non-OK response or a network failure MUST leave the visitor on the current
page, with the control's pending/disabled state cleared, instead of
redirecting as though logout had succeeded. This covers the nav-bar logout
button and all three dev role-switcher flows (its Logout item, its
switch-user action, and its post-reseed logout).

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

#### Scenario: A failed logout from the dev role-switcher does not redirect

- **GIVEN** a dev-mode visitor triggers the role-switcher's Logout item or
  picks another user to switch to
- **WHEN** `POST /auth/logout` resolves with a non-OK response, or the
  request fails outright
- **THEN** the browser neither navigates home nor proceeds to
  `/auth/dev-login`
- **AND** the switcher's controls are re-enabled (pending state cleared)
