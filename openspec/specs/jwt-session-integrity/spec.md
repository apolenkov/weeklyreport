# jwt-session-integrity Specification

## Purpose

TBD - created by archiving change harden-jwt-verify-algorithms. Update Purpose after archive.

## Requirements

### Requirement: Session-token verification pins the signing algorithm

Every verification of a session JWT MUST pass an explicit `algorithms` allow-list
of `["HS256"]` to `jwt.verify`, so a token presenting any other `alg` is rejected
regardless of the secret. This applies to all verify sites, including
`apps/api/src/modules/auth/auth.controller.ts` and
`apps/api/src/modules/pdf-export/pdf-export.service.ts`.

#### Scenario: A non-HS256 token is rejected

- **GIVEN** a token whose header declares an algorithm other than `HS256`
- **WHEN** session verification runs
- **THEN** verification throws and no session is established

#### Scenario: A valid HS256 token still verifies

- **GIVEN** a session token signed with `HS256` and the configured secret
- **WHEN** session verification runs
- **THEN** the decoded payload is returned and the session is established

### Requirement: The session signing secret meets a minimum strength

`AUTH_JWT_SECRET` MUST be present and at least 32 characters long. The single
require-secret site MUST reject a missing or too-short secret with a boot-time
error that names the variable and the minimum length, so the service fails fast
rather than running with a brute-forceable symmetric secret.

#### Scenario: A too-short secret fails boot

- **GIVEN** `AUTH_JWT_SECRET` set to a value shorter than 32 characters
- **WHEN** the require-secret check runs at startup
- **THEN** it throws an error naming `AUTH_JWT_SECRET` and the 32-character minimum
- **AND** the service does not start

#### Scenario: A conforming secret is accepted

- **GIVEN** `AUTH_JWT_SECRET` set to a value of at least 32 characters
- **WHEN** the require-secret check runs
- **THEN** it returns the secret and startup proceeds

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
