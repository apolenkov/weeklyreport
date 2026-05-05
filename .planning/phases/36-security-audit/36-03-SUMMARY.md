# Phase 36, Plan 03 — SUMMARY

**REQ-IDs:** SEC-03
**Commit:** `19e3d89 feat(36-03,36-04): production fences in env.schema + multi-origin CORS`
**Status:** complete

## What shipped

`apps/api/src/infrastructure/config/env.schema.ts` superRefine block extended with three new ZodIssueCode.custom checks under `data.NODE_ENV === 'production'`:

1. AUTH_DEV_MODE=true → "AUTH_DEV_MODE=true is forbidden when NODE_ENV=production"
2. PDF_EXPORT_JWT_SECRET equal to documented dev fallback `'dev-only-replace-in-production-min-32-chars'` → "PDF_EXPORT_JWT_SECRET must be overridden in production (default dev value detected)"
3. FRONTEND_URLS (when set) contains a `*` entry after split-trim → "FRONTEND_URLS must not include '*' in production"

## Side effect on existing dev compose

`docker-compose.yml` (DEV compose) had `NODE_ENV=production` + `AUTH_DEV_MODE=true` — which the new fence would reject. Flipped it to `NODE_ENV=development` in the same commit pair (38-01 follow-up commit).

## Verification

- TS clean.
- vitest 598/598 green (no env-schema regression test was added by this plan; the three fences are pure data validation).
- Manual: starting api with `NODE_ENV=production AUTH_DEV_MODE=true` exits 1 with the expected error message.

## Files

- `apps/api/src/infrastructure/config/env.schema.ts` (superRefine block extended)
