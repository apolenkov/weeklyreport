## ADDED Requirements

### Requirement: Shared deactivation-enforcement helper

The system SHALL provide one shared helper in `apps/api/src/modules/auth/` that, given a `userId`, a `PrismaService`, and a `SessionRevocationService`, returns whether the user is currently barred from access (revoked or deactivated), with two-tier semantics: a Redis revoked-set fast-path that fails open on Redis outage, then an authoritative Prisma `User.isActive` check that fails closed when the user is inactive.

All three authenticated entry paths that admit or rebuild a session from a JWT — the regular tRPC session path in `trpc.context.ts`, `buildPdfExportSession`, and the Bull Board `requireHead` guard — MUST derive their revoked/deactivated decision from this single helper rather than open-coding the check.

#### Scenario: Helper bars a deactivated user

- **GIVEN** a user whose `User.isActive` is `false`
- **WHEN** the helper is invoked with that user's id
- **THEN** the helper reports the user as barred from access

#### Scenario: Helper admits an active, non-revoked user

- **GIVEN** a user whose `User.isActive` is `true` and who is absent from the Redis revoked set
- **WHEN** the helper is invoked with that user's id
- **THEN** the helper reports the user as permitted

#### Scenario: Redis fast-path bars a revoked user before the Prisma read

- **GIVEN** a user id present in the Redis revoked set
- **WHEN** the helper is invoked
- **THEN** the helper reports the user as barred regardless of the Prisma `isActive` value

#### Scenario: Redis outage fails open to the Prisma authoritative check

- **GIVEN** the Redis revoked-set lookup throws or times out
- **AND** the user's `User.isActive` is `true`
- **WHEN** the helper is invoked
- **THEN** the helper does not bar the user on the Redis error alone
- **AND** the authoritative Prisma `isActive` check governs the outcome

### Requirement: PDF-export session rebuild enforces deactivation

The system SHALL reject a PDF-export render session when the requester recorded in the token (`requestedBy`) is revoked or deactivated, by making `buildPdfExportSession` consult the shared helper and return `null` for a barred requester so the auth middleware denies the request.

This requirement covers only the `requestedBy` path; the legacy no-`requestedBy` synthetic session resolves no real user and is out of scope.

#### Scenario: Deactivated requester yields no PDF session

- **GIVEN** a valid PDF-export token carrying a `requestedBy` whose user is deactivated
- **WHEN** `buildPdfExportSession` runs for that token
- **THEN** it returns `null`
- **AND** no PDF-export context is granted for the request

#### Scenario: Active requester still receives the scoped PDF session

- **GIVEN** a valid PDF-export token whose `requestedBy` user is active and not revoked
- **WHEN** `buildPdfExportSession` runs for that token
- **THEN** it returns the requester's hydrated session as before
- **AND** the PDF-export read-only guard restrictions still apply

### Requirement: Bull Board queue-admin guard enforces deactivation

The system SHALL reject access to `/admin/queues` when the session's user is revoked or deactivated, by making the `requireHead` guard async, resolving `PrismaService` and the existing `SessionRevocationService` from Nest DI (`_app.get`, not a freshly constructed instance, so the service's lifecycle cleanup still runs), and consulting the shared helper after the JWT verification and head-role check.

#### Scenario: Deactivated head is denied queue admin

- **GIVEN** a valid session JWT for a head whose `User.isActive` is now `false`
- **WHEN** a request reaches the `requireHead` guard on `/admin/queues`
- **THEN** the guard responds 401 and does not call `next()`
- **AND** the Bull Board router is never reached

#### Scenario: Revoked head is denied via the Redis fast-path

- **GIVEN** a valid session JWT for a head whose id is in the Redis revoked set
- **WHEN** a request reaches the `requireHead` guard
- **THEN** the guard denies access without depending on the Prisma `isActive` value

#### Scenario: Active head still reaches the queue dashboard

- **GIVEN** a valid session JWT for a head who is active and not revoked
- **WHEN** a request reaches the `requireHead` guard
- **THEN** the guard calls `next()` and the Bull Board router serves the dashboard

### Requirement: Regular session path uses the shared helper unchanged in behavior

The system SHALL route the regular tRPC session path's revoked/deactivated decision through the shared helper while preserving its existing observable behavior: a revoked or deactivated session token is treated as invalid and does not yield a regular authenticated session.

#### Scenario: Deactivated session token is rejected as before

- **GIVEN** a valid-looking session JWT whose user is deactivated
- **WHEN** the regular session path evaluates it via the shared helper
- **THEN** the token is treated as invalid
- **AND** the request does not gain a regular authenticated session
