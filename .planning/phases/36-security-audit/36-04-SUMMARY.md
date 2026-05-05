# Phase 36, Plan 04 — SUMMARY

**REQ-IDs:** SEC-04
**Commit:** `19e3d89 feat(36-03,36-04): production fences in env.schema + multi-origin CORS`
**Status:** complete

## What shipped

- `env.schema.ts`: new optional `FRONTEND_URLS` field (z.string().optional()), CSV-encoded list of additional CORS origins.
- `main.ts`: `allowedOrigins = Array.from(new Set([FRONTEND_URL, ...FRONTEND_URLS.split(',').map(trim).filter(Boolean)]))`. `app.enableCors({ origin: allowedOrigins, credentials: true })`. Boot logs the origin list at info level.
- `.env.example`: commented-out example documenting the new var with a multi-origin sample.

## Why an array, not a wildcard match

Express's `cors` middleware reflects the request's Origin only when it matches one of the array entries. There is no wildcard substring match — if `FRONTEND_URLS` doesn't contain the requesting origin, the response gets no `Access-Control-Allow-Origin` header and the browser drops the response. This is the safe default for cookie-based auth (SameSite=Lax cookies + matched origin = no cross-origin token theft path).

## Verification

- TS clean.
- vitest 598/598 green.
- Manual: 200 from whitelisted origin; 200 from non-whitelisted (no ACAO header → browser drops) — Playwright probe confirmed expected behavior.

## Files

- `apps/api/src/infrastructure/config/env.schema.ts` (new FRONTEND_URLS field)
- `apps/api/src/main.ts` (allowedOrigins build + log + enableCors array)
- `.env.example` (documentation comment)
