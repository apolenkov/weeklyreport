# Phase 38, Plan 01 — SUMMARY

**REQ-IDs:** INF-01
**Commits:**

- `aa2f237 feat(38-01): docker-compose.prod.yml with migrate init-container`
- `0abd2f1 feat(38-01): harden docker-compose.prod.yml env fences`

**Status:** complete

## What shipped

### apps/api/scripts/migrate.sh (new)

Single-line wrapper: `set -eu; echo log; exec npx prisma migrate deploy`. Same entrypoint will serve a future K8s init-container.

### docker-compose.prod.yml (existing → hardened)

- migrate service `command: ["sh", "apps/api/scripts/migrate.sh"]` (was inline npx).
- api env fences: every prod env declared with `${VAR:?msg}` — compose refuses to start without DB*PASSWORD, AUTH_JWT_SECRET, PDF_EXPORT_JWT_SECRET, FRONTEND_URL, NEXT_PUBLIC_API_URL, all five SMTP\*\*, all four KEYCLOAK*SAML\*\*.
- api `FRONTEND_URLS` (Phase 36-04 multi-origin) wired through.
- api healthcheck: `/health/ready` instead of `/health/live`; start_period 30→60s for first migration + tRPC bootstrap.
- New `apilogs:/app/logs` volume; api env LOG_DIR=/app/logs.

### docker-compose.yml (DEV — bug fix side)

Was NODE_ENV=production + AUTH_DEV_MODE=true. The new 36-03 fence (production + dev-mode → boot abort) would crash this on `docker compose up`. Flipped to NODE_ENV=development which matches the dev compose's actual intent.

## Verification

- `docker compose -f docker-compose.prod.yml config` validates without missing-var errors when an `.env.prod` is loaded with all required keys.
- `docker compose up` (dev compose) still boots cleanly post-flip.
- TS unaffected (this plan touches no TS).

## Files

- `apps/api/scripts/migrate.sh` (new, executable)
- `docker-compose.prod.yml` (hardened — 32 insertions, 8 deletions)
- `docker-compose.yml` (NODE_ENV flip — 9 insertions, 2 deletions)
