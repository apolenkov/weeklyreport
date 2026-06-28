# api-input-hardening Specification

## Purpose

Defense-in-depth hardening of the inbound request surface in `apps/api`.
Covers four related gaps found in the 2026-06-28 security review:
the JWT verifier accepts any algorithm, the correlation-id header is
adopted verbatim with no length or charset cap, the full-text search
query reaches `plainto_tsquery` without a null-byte guard (causing an
unhandled 500), and the `dev.wipeAndReseed` tRPC procedure is callable
by any authenticated role rather than admin only.

Consumer surfaces:

- `apps/api/src/modules/auth/auth.controller.ts` — `verifySessionToken`
- `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`
- `packages/shared/src/schemas/search.ts` — `searchQuerySchema`
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `dev.wipeAndReseed`

## ADDED Requirements

### Requirement: JWT verify pins algorithm to HS256

`auth.controller.ts` MUST pass `{ algorithms: ['HS256'] }` as the options
argument to `jwt.verify` when validating session tokens. This is a
defense-in-depth pin: the shared secret is symmetric HMAC so `none` or
asymmetric alg substitution cannot succeed, but an explicit algorithm
list eliminates the alg-confusion class entirely and makes the intent
auditable.

#### Scenario: HS256-signed token is accepted

- **GIVEN** a valid session token signed with HS256
- **WHEN** `verifySessionToken` processes the token
- **THEN** verification succeeds and the session payload is returned

#### Scenario: Token with a mismatched algorithm claim is rejected

- **GIVEN** a JWT whose `alg` header is not `'HS256'` (e.g. `none` or `RS256`)
- **WHEN** `verifySessionToken` processes the token
- **THEN** `jwt.verify` throws and verification fails with an error surfaced
  as an `Unauthorized` tRPC error

### Requirement: x-request-id is capped before adoption

The correlation-id middleware MUST validate the inbound `x-request-id`
header before using it as the CLS `correlationId`. The header MUST be
accepted only when it is 1–128 characters long and contains only
printable ASCII (0x20–0x7E, no control characters). When the header is
absent or fails validation, the middleware MUST generate a fresh UUID v4
as the correlation id.

Consumer surface: `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`.

#### Scenario: Valid x-request-id is adopted

- **GIVEN** an inbound request with `x-request-id: req-abc-123`
- **WHEN** the correlation-id middleware runs
- **THEN** the CLS correlationId is set to `'req-abc-123'`

#### Scenario: Oversized x-request-id is replaced with a fresh UUID

- **GIVEN** an inbound request with an `x-request-id` value longer than 128 characters
- **WHEN** the correlation-id middleware runs
- **THEN** the CLS correlationId is a freshly generated UUID, not the inbound value

#### Scenario: x-request-id containing a control character is rejected

- **GIVEN** an inbound request with `x-request-id` containing a null byte or CRLF
- **WHEN** the correlation-id middleware runs
- **THEN** the CLS correlationId is a freshly generated UUID, not the inbound value

#### Scenario: Absent x-request-id generates a UUID

- **GIVEN** an inbound request with no `x-request-id` header
- **WHEN** the correlation-id middleware runs
- **THEN** the CLS correlationId is a freshly generated UUID v4

### Requirement: Search query is validated with safeText

The `searchQuerySchema` in `packages/shared/src/schemas/search.ts` MUST
constrain the `q` field using the project's `safeText()` helper
(minimum 1 character, maximum 200 characters, no null bytes). A raw
`z.string()` is insufficient because a null byte reaches
`plainto_tsquery` and causes an unhandled Postgres 500.

Consumer surface: every tRPC procedure that accepts a `search` input
(currently `search.query` in `apps/api/src/infrastructure/trpc/trpc.router.ts`).

#### Scenario: Normal search query is accepted

- **GIVEN** a search request with `q: 'weekly report'`
- **WHEN** the router validates the input
- **THEN** validation passes and the query reaches the repository

#### Scenario: Null-byte search query is rejected at the schema boundary

- **GIVEN** a search request with `q` containing a null byte (`\0`)
- **WHEN** the router validates the input
- **THEN** Zod parsing throws a validation error and the request fails with a
  `BAD_REQUEST` tRPC error before reaching `plainto_tsquery`

#### Scenario: Empty search query is rejected

- **GIVEN** a search request with `q: ''`
- **WHEN** the router validates the input
- **THEN** Zod parsing throws a validation error (minimum length not met)

### Requirement: dev.wipeAndReseed is restricted to adminProcedure

The `dev.wipeAndReseed` tRPC procedure MUST use `adminProcedure` (not
`protectedProcedure`). In a shared dev/UAT environment with
`AUTH_DEV_MODE=true`, any authenticated user — including viewers and leads
— can currently trigger a full `migrate reset` and reseed. Restricting to
`adminProcedure` limits the capability to the admin role while leaving the
existing `AUTH_DEV_MODE` production fence in place.

Consumer surface: `apps/api/src/infrastructure/trpc/trpc.router.ts`
(`dev.wipeAndReseed`) and the role-coverage gate in
`apps/api/src/infrastructure/trpc/trpc.middleware.ts` (`adminProcedure`).

#### Scenario: Admin triggers wipeAndReseed successfully

- **GIVEN** `AUTH_DEV_MODE=true` and an authenticated session with role `admin`
- **WHEN** `dev.wipeAndReseed` is called
- **THEN** the procedure executes and the database is reset and reseeded

#### Scenario: Lead cannot trigger wipeAndReseed

- **GIVEN** `AUTH_DEV_MODE=true` and an authenticated session with role `lead`
- **WHEN** `dev.wipeAndReseed` is called
- **THEN** the procedure returns `FORBIDDEN` without executing the wipe
