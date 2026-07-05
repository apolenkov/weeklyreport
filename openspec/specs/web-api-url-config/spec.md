# web-api-url-config Specification

## Purpose

TBD - created by archiving change centralize-web-api-url. Update Purpose after archive.

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
