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

### Requirement: Missing user row is treated as access-barred

The shared deactivation helper SHALL treat a missing (null) `User` row — a hard-deleted user that Prisma `findUnique` does not return — as barred from access (fail closed), so a hard-deleted user cannot keep a working session for the JWT TTL.

The regular tRPC session path's deactivation check MUST therefore bar when the row is null OR inactive (`if (!userRow || !userRow.isActive)`), not only when an existing row is inactive (`if (userRow && !userRow.isActive)`). Admin snapshot-restore hard-deletes unreferenced users via `prisma.user.delete` in `admin-snapshot-write.queries.ts` WITHOUT adding them to the Redis revoked set, so the Redis fast-path never fires and the null-row case is the only thing standing between a deleted user and a live ~1h session. The PDF path already fails closed on null (`buildPdfExportSession` returns `null` when the requester no longer exists); this requirement closes the equivalent gap on the regular path, which it inherits once routed through the helper.

#### Scenario: Helper bars a missing user

- **GIVEN** a userId for which `prisma.user.findUnique` returns `null`
- **AND** that userId is absent from the Redis revoked set
- **WHEN** the helper is invoked with that userId
- **THEN** the helper reports the user as barred from access

#### Scenario: Session for a deleted user is rejected

- **GIVEN** a valid-looking session JWT whose user row has been hard-deleted (e.g. by admin snapshot-restore) and was never added to the Redis revoked set
- **WHEN** the regular tRPC session path evaluates the token via the shared helper
- **THEN** the helper reports the user as barred
- **AND** the token is treated as invalid and the request does not gain a regular authenticated session

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

The system SHALL route the regular tRPC session path's revoked/deactivated decision through the shared helper while preserving its existing observable behavior for the revoked and deactivated cases: a revoked or deactivated session token is treated as invalid and does not yield a regular authenticated session.

The one intentional behavior change on this path is the null-user-row case, covered by the "Missing user row is treated as access-barred" requirement above: a hard-deleted user goes from fail-open (today) to fail-closed. The revoked-set fast-path and the existing-but-inactive `isActive=false` outcomes are unchanged.

#### Scenario: Deactivated session token is rejected as before

- **GIVEN** a valid-looking session JWT whose user is deactivated
- **WHEN** the regular session path evaluates it via the shared helper
- **THEN** the token is treated as invalid
- **AND** the request does not gain a regular authenticated session
