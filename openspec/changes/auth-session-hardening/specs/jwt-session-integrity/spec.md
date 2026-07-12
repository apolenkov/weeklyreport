## ADDED Requirements

### Requirement: Logout is stateless and does not revoke the session JWT

Logout MUST clear the client-side session cookie, but MUST NOT be relied
upon to invalidate the underlying signed JWT. A token copied out of the
cookie before logout remains verifiable, and therefore usable, until its
own expiry (1 hour). Per-session revocation ahead of expiry would require
tracking a `jti` per issued token and is out of scope; this requirement
records the tradeoff as accepted, not as a defect.

#### Scenario: A copied token outlives a logout

- **GIVEN** a valid session JWT copied out of the cookie before the user
  logs out
- **WHEN** the user then logs out, clearing their browser's session cookie
- **THEN** the copied token still passes verification and can still
  establish a session until its original 1-hour expiry
