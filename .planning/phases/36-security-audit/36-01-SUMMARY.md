# Phase 36, Plan 01 — SUMMARY

**REQ-IDs:** SEC-01
**Commit:** `6b9e938 feat(36-01): rate-limit /auth (5/min) + /trpc (200/min) per IP`
**Status:** complete

## What shipped

- New `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` factory: returns `{authLimiter, trpcLimiter}` backed by express-rate-limit. Configurable via `{logger, isTest}`. windowMs=60_000; X-Forwarded-For-aware keyGenerator; standard-headers draft-7; structured 429 JSON body.
- `apps/api/src/main.ts` mounts the limiters:
  - `expressApp.use('/trpc', trpcLimiter, ...)` before tRPC adapter
  - `expressApp.use('/auth', authLimiter)` before `mountAuthRoutes`
- `apps/api/package.json` adds `express-rate-limit` to dependencies.

## Verification

- TS clean.
- vitest 598/598 still green (no test mocks the rate-limit middleware).
- Manual: 6th rapid login → 429 with `Retry-After` header.
- E2E: NODE_ENV=test bumps every bucket to 1000/min; existing specs pass without per-test backoff.

## Files

- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` (new)
- `apps/api/src/main.ts` (3 inserts: import, /trpc wrap, /auth wrap)
- `apps/api/package.json` (+ express-rate-limit)
