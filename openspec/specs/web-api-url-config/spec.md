# web-api-url-config Specification

## Purpose

Resolve the web API base URL and tRPC batch decoding through fail-loud shared seams while gating dev-auth fallback through one predicate.

## Requirements

### Requirement: API base URL resolves fail-loud with no silent fallback

The web app MUST resolve the API base URL through a single seam
(`requireApiUrl` in `apps/web/src/lib/server/api-url.ts`) that reads `API_URL`
then `NEXT_PUBLIC_API_URL` and throws a descriptive error when neither is set.
It MUST NOT fall back to a hardcoded `http://localhost:3002` (or any other
default). Every consumer — `apps/web/next.config.ts`,
`apps/web/src/app/api/client-logs/route.ts`,
`apps/web/src/lib/server/get-org-public.ts`,
`apps/web/src/lib/server/get-server-session.ts`, and
`apps/web/src/lib/server/get-print-route-context.ts` — MUST obtain the URL from
this seam, so a missing value fails loud at config-load / request time rather
than silently targeting localhost.

#### Scenario: both env vars unset

- **GIVEN** neither `API_URL` nor `NEXT_PUBLIC_API_URL` is set in the
  environment
- **WHEN** any consumer calls `requireApiUrl`
- **THEN** it throws an error naming the missing variables and does not return
  a localhost or other default value

#### Scenario: API_URL takes precedence

- **GIVEN** `API_URL=https://api.example.com` and
  `NEXT_PUBLIC_API_URL=https://api.public` are both set
- **WHEN** a consumer calls `requireApiUrl`
- **THEN** it returns `https://api.example.com` (the `API_URL` precedence of the
  former inline chain is preserved)

#### Scenario: only the public var is set

- **GIVEN** `API_URL` is unset and `NEXT_PUBLIC_API_URL=https://api.public`
- **WHEN** a consumer calls `requireApiUrl`
- **THEN** it returns `https://api.public`

### Requirement: Org-identity transport failure degrades to the generic identity and is reported

Config resolution and transport failure are separate categories in
`apps/web/src/lib/server/get-org-public.ts`. `requireApiUrl()` is called OUTSIDE
the try, so a missing base URL still fails loud per the requirement above. A
failure of the `org.getPublic` FETCH — non-ok status, undecodable payload, or a
thrown transport error — MUST NOT propagate: `getOrgPublic` feeds the ROOT
`generateMetadata` in `apps/web/src/app/layout.tsx` as well as
`apps/web/src/app/page.tsx`, so a throw blanks every route that renders the root
layout, not just the landing page. It MUST return `DEFAULT_ORGANIZATION_IDENTITY`
instead.

That degrade MUST NOT be silent. Each of the three branches MUST emit a
server-side error log naming which branch fired — stderr is the sink every
deployment has, so this clause is enforceable regardless of observability
wiring — AND MUST forward the same failure to Sentry, which reports only where a
DSN is configured (`docker-compose.prod.yml` supplies `SENTRY_DSN` to the `web`
service for that reason).

This requirement is scoped to `getOrgPublic`. Applying
`DEFAULT_ORGANIZATION_IDENTITY` elsewhere is not a failure and MUST NOT be
reported: `apps/web/src/shared/ui/navigation/nav-bar-model.ts` uses it as a
loading skeleton while the session query is in flight.

#### Scenario: non-ok response from org.getPublic

- **GIVEN** the API answers `org.getPublic` with a non-ok HTTP status
- **WHEN** `getOrgPublic` runs
- **THEN** it returns `DEFAULT_ORGANIZATION_IDENTITY`, logs a server-side error
  naming the `http-status` branch, and captures the failure to Sentry tagged
  with that branch

#### Scenario: undecodable payload

- **GIVEN** the API answers with a body that `decodeOrgPublicResponse` cannot
  narrow to an `OrganizationPublic`
- **WHEN** `getOrgPublic` runs
- **THEN** it returns `DEFAULT_ORGANIZATION_IDENTITY`, logs a server-side error
  naming the `decode` branch, and captures the failure to Sentry tagged with
  that branch

#### Scenario: transport error

- **GIVEN** the fetch to `org.getPublic` rejects (API down, DNS failure, body
  read error)
- **WHEN** `getOrgPublic` runs
- **THEN** it returns `DEFAULT_ORGANIZATION_IDENTITY`, logs a server-side error
  naming the `transport` branch, and captures the failure to Sentry tagged with
  that branch

#### Scenario: a missing base URL still fails loud

- **GIVEN** neither `API_URL` nor `NEXT_PUBLIC_API_URL` is set
- **WHEN** `getOrgPublic` runs
- **THEN** `requireApiUrl` throws before any fetch is attempted and the generic
  identity is NOT substituted, because config is not a transport failure

### Requirement: A single seam decodes tRPC v11 superjson batch responses

The web app MUST decode tRPC v11 superjson-batched query responses through one
shared helper (`decodeTrpcBatchPayload` in
`apps/web/src/lib/server/api-url.ts`) rather than re-implementing the
batch-envelope unwrap per call site. The helper MUST return the inner payload
of the first batch entry, unwrapping the superjson `{ json }` wrapper when
present, and MUST return `null` when the body is not a non-empty array, when
the first entry carries an `error`, or when its `result.data` is `null` or
`undefined`. Each server helper (`get-org-public`, `get-server-session`,
`get-print-route-context`) MUST layer its own typed narrowing on top of this
shared decode.

#### Scenario: superjson-wrapped payload

- **GIVEN** a batch body `[{ result: { data: { json: <payload> } } }]`
- **WHEN** a consumer calls `decodeTrpcBatchPayload(body)`
- **THEN** it returns `<payload>` (the inner `json` value)

#### Scenario: un-transformed payload

- **GIVEN** a batch body `[{ result: { data: <payload> } }]` with no `json`
  wrapper
- **WHEN** a consumer calls `decodeTrpcBatchPayload(body)`
- **THEN** it returns `<payload>` unchanged (config-drift tolerance is
  preserved)

#### Scenario: error or empty entry

- **GIVEN** a batch body that is empty, non-array, carries an `error` on the
  first entry, or whose `result.data` is `null`/`undefined`
- **WHEN** a consumer calls `decodeTrpcBatchPayload(body)`
- **THEN** it returns `null`

### Requirement: Dev-auth session fallback is gated by one predicate

The web server session helpers MUST decide whether to attempt the dev-auth
session fallback through one shared predicate (`shouldUseDevAuthFallback` in
`apps/web/src/lib/server/api-url.ts`). The predicate MUST return `true` only
when `NODE_ENV` is not `production` AND (`AUTH_DEV_MODE === "true"` OR
`AUTH_DEV_MODE_ALLOW_TEST === "true"`); otherwise it MUST return `false`. Both
`get-server-session` and `get-print-route-context` MUST use this predicate
instead of re-inlining the environment check.

#### Scenario: dev mode outside production

- **GIVEN** `NODE_ENV=development` and `AUTH_DEV_MODE=true`
- **WHEN** a helper calls `shouldUseDevAuthFallback` with no session cookie
  present
- **THEN** it returns `true` and the helper proceeds to resolve the session
  without a cookie

#### Scenario: production never falls back

- **GIVEN** `NODE_ENV=production` and `AUTH_DEV_MODE=true`
- **WHEN** a helper calls `shouldUseDevAuthFallback`
- **THEN** it returns `false`

#### Scenario: dev mode off

- **GIVEN** `NODE_ENV=test`, `AUTH_DEV_MODE` unset, and
  `AUTH_DEV_MODE_ALLOW_TEST` unset
- **WHEN** a helper calls `shouldUseDevAuthFallback`
- **THEN** it returns `false`
