# jwt-session-integrity Specification

## Purpose

Protect session identity with pinned JWT algorithms, strong secrets, explicit stateless logout, SAML identity cross-checks, and one revocation-policy gate.

## Requirements

### Requirement: Session-token verification pins the signing algorithm

Every verification of a session JWT MUST pass an explicit `algorithms` allow-list
of `["HS256"]` to `jwt.verify`, so a token presenting any other `alg` is rejected
regardless of the secret. This applies to the session verify sites, including
`apps/api/src/modules/auth/auth.controller.ts`, while the separate PDF artifact
token is verified in `apps/api/src/modules/pdf-export/pdf-export.token.ts` with
its own pinned algorithm.

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

### Requirement: SAML identity matching cross-checks the persisted samlId

When resolving a SAML profile to a stored user, session construction MUST NOT
accept an email match as the same identity when the persisted and incoming
`samlId` values differ. `samlId` is required on every persisted User and is the
stable fallback when a user's email changes.

#### Scenario: Reused email with a different samlId is not silently inherited

- **GIVEN** a stored user with email `lead1@example.com` and `samlId` `A`
- **WHEN** a SAML profile presents email `lead1@example.com` and `samlId` `B`
- **THEN** the session build does not treat the stored user as the same
  identity on the email match alone

#### Scenario: Matching samlId confirms the identity

- **GIVEN** a stored user with email `lead1@example.com` and `samlId` `A`
- **WHEN** a SAML profile presents email `lead1@example.com` and `samlId` `A`
- **THEN** the session build accepts the existing user as the same identity

### Requirement: The revocation check is a single fail-open/fail-closed two-tier gate

Every JWT-admitting entry path carrying a human requester identity (regular
tRPC session, requester-bound PDF-export rebuild, Bull Board admin guard) MUST
consult the same revocation decision so a stale JWT cannot outlive a
deactivation. The gate has two tiers, in order:

1. Redis revoked-set fast path, **fail-OPEN**: a thrown/failed lookup must NOT
   bar the user, otherwise a Redis outage would lock everyone out; the
   authoritative Prisma read below is the safety net.
2. Prisma `isActive` read, **fail-CLOSED**: a missing/`null` row OR
   `isActive === false` bars the user. Barring the missing row closes the
   hard-deleted-user gap — the dedicated admin remove command may delete a
   reference-free user without touching the revoked set, so the fast path never
   fires for them. Users retained by published history are deactivated instead.

#### Scenario: A revoked user is barred before any Prisma read

- **GIVEN** a user whose id sits in the Redis revoked set
- **WHEN** any JWT-admitting entry path runs the revocation gate
- **THEN** access is barred without consulting the user row

#### Scenario: A Redis outage does not lock users out

- **GIVEN** the Redis revoked-set lookup throws
- **WHEN** the revocation gate runs
- **THEN** the user is NOT barred by the fast path and the Prisma `isActive`
  read remains the deciding authority

#### Scenario: A hard-deleted or deactivated user is barred

- **GIVEN** a user row that is missing (hard-deleted) or carries
  `isActive=false`
- **WHEN** the revocation gate reaches the Prisma read
- **THEN** access is barred

### Requirement: Role and reporting group come from the database on every request

Human-session resolution and the Bull Board head guard MUST take the requester's
`role` and `reportingGroupId` from the same Prisma read as the `isActive` gate,
overriding the JWT claims, so an administrator's role or group change applies on
the user's next request without revoking the session.

#### Scenario: A demoted user loses the old role immediately

- **GIVEN** a valid JWT issued while the user was `head`
- **WHEN** the database role is `lead` and the user makes a request
- **THEN** the resolved session role is `lead`
- **AND** the Bull Board guard responds 403

#### Scenario: A moved user takes the new group

- **GIVEN** a valid JWT carrying reporting group `A`
- **WHEN** the database group is `B` (or none)
- **THEN** the resolved session carries `B` (or no group)

### Requirement: Session hydration reuses the live-access read

Human-session resolution MUST obtain the live reporting group name, the
requester's own section of the active report when the token lacks one, and a
viewer's group grants from the same Prisma read as the `isActive` gate.
Hydration MUST NOT repeat those lookups for that session, and the values MUST
reflect the database, not the token.

#### Scenario: One user read serves group name and section

- **GIVEN** a valid lead token without an active section id
- **WHEN** the session is resolved
- **THEN** the session carries the database group name and the lead's section id
- **AND** no separate reporting-group or report-section query is issued

#### Scenario: One user read serves a viewer's group grants

- **GIVEN** a valid viewer token
- **WHEN** the session is resolved
- **THEN** the session carries the database group grants of the viewer
- **AND** no separate viewer-group-access query is issued
