## Why

A developer setting up `apps/web` cannot tell whether the API URL is mandatory:
six code sites silently fall back to `http://localhost:3002`, so a missing
`API_URL` in staging or prod resolves to a dead localhost instead of failing at
boot. The same superjson tRPC batch-decode and dev-auth-fallback logic are
hand-copied across the three server session helpers, and one placeholder
component (`api-readiness-placeholder.tsx`) is dead code still carrying its own
fallback copy. Recon confirmed `apps/web` has NO env validation at all (unlike
`apps/api`); this change is the fail-loud fix for the API URL specifically.

## What Changes

- Add one server module (`apps/web/src/lib/server/api-url.ts`) exporting three
  seams: `requireApiUrl` (fail-loud, no localhost fallback), a generic
  `decodeTrpcBatchPayload` (superjson batch-envelope unwrap), and
  `shouldUseDevAuthFallback` (the `NODE_ENV`/`AUTH_DEV_MODE` predicate).
- **BREAKING (operational):** the `?? "http://localhost:3002"` fallback is
  removed everywhere; boot / config-load fails loud when neither `API_URL` nor
  `NEXT_PUBLIC_API_URL` is set. Every environment (`.env`, docker compose,
  Playwright webServer) must supply one explicitly.
- Rewire the five live consumers to the new module: `next.config.ts`,
  `app/api/client-logs/route.ts`, `lib/server/get-org-public.ts`,
  `lib/server/get-server-session.ts`, `lib/server/get-print-route-context.ts`.
  `client-logs/route.ts` today reads `API_URL` only; via `requireApiUrl` it
  gains the `NEXT_PUBLIC_API_URL` precedence leg — an intended change that points
  its log forwarding at the real API in any env that sets only that var (root
  `.env`, CI). See `design.md`.
- Delete the dead `components/common/api-readiness-placeholder.tsx` (no importer).

## Capabilities

### New Capabilities

- `web-api-url-config`: the single web-side seam for resolving the API base URL
  (fail-loud, no silent default), decoding tRPC v11 superjson batch responses,
  and gating the dev-auth session fallback.

### Modified Capabilities

<!-- None. No existing spec governs API-URL resolution; client-error-policy and
     report-routing are unrelated to this seam. -->

## Impact

- Code: `apps/web/src/lib/server/*`, `apps/web/next.config.ts`,
  `apps/web/src/app/api/client-logs/route.ts`; one file deleted.
- Config: all web runtime/CI environments must declare `API_URL` (or
  `NEXT_PUBLIC_API_URL`) — a missing value now fails loud instead of silently
  targeting localhost. The `.env.example` `API_URL` comment (which still
  advertises a deleted `resolveApiUrl` default) is rewritten to match.
- Tests: the web unit suite is made deterministic (stub `NEXT_PUBLIC_API_URL` in
  the two helper tests, or `test.env` in `apps/web/vitest.config.ts`) since it
  loads no env file and relied on the removed fallback.
- No API, Prisma, or shared-schema changes; no data migration.
