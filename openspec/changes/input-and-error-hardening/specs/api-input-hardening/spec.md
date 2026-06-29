# api-input-hardening Specification

## Purpose

Defense-in-depth hardening of the inbound request surface in `apps/api`.
Covers five related gaps found in the 2026-06-28 security review:
the JWT verifier accepts any algorithm, the correlation-id header is
adopted verbatim with no length or charset cap, the full-text search
query reaches `plainto_tsquery` without a null-byte guard (causing an
unhandled 500), the `dev.wipeAndReseed` tRPC procedure is callable
by any authenticated role rather than admin only, and the tRPC context
reads the session cookie under a hardcoded name that ignores the
`AUTH_JWT_COOKIE_NAME` knob every other auth site honors.

Consumer surfaces:

- `apps/api/src/modules/auth/auth.controller.ts` — `verifySessionToken`
- `apps/api/src/infrastructure/middleware/correlation-id.middleware.ts`
- `packages/shared/src/schemas/search.ts` — `searchQueryInputSchema`
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `dev.wipeAndReseed`
- `apps/api/src/infrastructure/trpc/trpc.context.ts` — session cookie read

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

The `searchQueryInputSchema` in `packages/shared/src/schemas/search.ts` MUST
constrain the `q` field using the project's `safeText()` helper
(minimum 2 characters, maximum 200 characters, no null bytes, no
invisible-only input). The existing `z.string().min(2).max(200)` keeps
the correct min-2 floor but lacks a null-byte guard, so a null byte
reaches `plainto_tsquery` and causes an unhandled Postgres 500. The
min-2 floor MUST be preserved — switching to `safeText` adds the
null-byte and invisible-only refinements without lowering the floor.

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

#### Scenario: Single-character search query is rejected

- **GIVEN** a search request with `q: 'a'`
- **WHEN** the router validates the input
- **THEN** Zod parsing throws a validation error because the min-2 floor is
  not met

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

### Requirement: DevRoleSwitcher reset controls are admin-only

The `DevRoleSwitcher` data-reset controls MUST be hidden or disabled unless the
current dev session role is `admin`. These controls (`Wipe + Reseed (small)`,
`(middle)`, `(huge)`, and `Wipe reports (manual UAT)`) call `dev.wipeAndReseed`,
which is now restricted to `adminProcedure`. Rendering them for non-admin dev
sessions would surface a `FORBIDDEN` error as an `alert(...)`, so the client
MUST gate them to match the server-side restriction.

Consumer surface: `apps/web/src/components/dev/role-switcher.tsx`
(`DevRoleSwitcher`).

#### Scenario: Admin dev session sees the reset controls

- **GIVEN** the dev role switcher is enabled and the current session role is
  `admin`
- **WHEN** the switcher menu is opened
- **THEN** the four data-reset controls are present and actionable

#### Scenario: Non-admin dev session does not see actionable reset controls

- **GIVEN** the dev role switcher is enabled and the current session role is
  `lead`, `head`, or `viewer`
- **WHEN** the switcher menu is opened
- **THEN** the four data-reset controls are absent or disabled, so no
  `FORBIDDEN` alert can be triggered

### Requirement: tRPC context resolves the session cookie name from AUTH_JWT_COOKIE_NAME

The tRPC context factory MUST resolve the session-token cookie name from
`AUTH_JWT_COOKIE_NAME`, falling back to the literal `customreport_session`
when the environment variable is unset. `trpc.context.ts` currently reads
`req.cookies?.customreport_session` with a hardcoded name, so when the knob
is set to a non-default value every authenticated tRPC call fails closed
with `Unauthorized` even though the cookie is present under the configured
name. The resolution MUST use the same `env.AUTH_JWT_COOKIE_NAME ?? "customreport_session"`
single-source-of-truth pattern already used by `auth.controller.ts`,
`auth.routes.ts`, `jwt.strategy.ts`, and `pdf-export.service.ts`.

Consumer surface: `apps/api/src/infrastructure/trpc/trpc.context.ts`.

#### Scenario: Default cookie name is honored when the knob is unset

- **GIVEN** `AUTH_JWT_COOKIE_NAME` is unset and a request carries a
  `customreport_session` cookie with a valid token
- **WHEN** the tRPC context factory reads the request
- **THEN** the token is taken from the `customreport_session` cookie and the
  session is verified

#### Scenario: Custom cookie name is honored when the knob is set

- **GIVEN** `AUTH_JWT_COOKIE_NAME=app_session` and a request carries an
  `app_session` cookie with a valid token (and no `customreport_session` cookie)
- **WHEN** the tRPC context factory reads the request
- **THEN** the token is taken from the `app_session` cookie and the session is
  verified, instead of being treated as unauthenticated
