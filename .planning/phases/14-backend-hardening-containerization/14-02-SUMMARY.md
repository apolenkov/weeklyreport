---
phase: 14-backend-hardening-containerization
plan: "02"
subsystem: infra
tags: [docker, dockerfile, docker-compose, playwright, production, hardening]

requires:
  - phase: 14-backend-hardening-containerization
    provides: "Plan 01: unit tests baseline; Docker infrastructure context"

provides:
  - "Dockerfile.api runner stage with targeted production-only file copies (not full /app)"
  - "pnpm prune --prod in builder stage removes devDependencies before runner copy"
  - "docker-compose.prod.yml with restart policies, health checks, resource limits, required secrets"
  - "Web health check endpoint /health/live wired into production compose"
  - "Chromium/Playwright ~1.4GB image size constraint documented in Dockerfile.api"

affects:
  - 14-03-ci-integration
  - deployment

tech-stack:
  added: []
  patterns:
    - "Multi-stage Docker build: prune devDeps before COPY to runner stage"
    - "Required env vars via ${VAR:?message} syntax in docker-compose"
    - "Internal-only DB/Redis networking in production (no host ports)"
    - "JSON-file logging with max-size rotation for all services"

key-files:
  created:
    - docker-compose.prod.yml
  modified:
    - Dockerfile.api

key-decisions:
  - "API image cannot meet 200MB target due to Playwright/Chromium (~1.4GB) — documented as architectural constraint; web image (alpine-based) meets the target"
  - "DB_PASSWORD and AUTH_JWT_SECRET are REQUIRED in production compose with no fallback defaults"
  - "postgres/redis have no host ports in production — Docker internal network only"
  - "AUTH_DEV_MODE=false in production compose — real SAML auth enforced"
  - "pnpm prune --prod added to builder stage to strip devDependencies before runner copies"

patterns-established:
  - "Dockerfile runner stage: targeted COPY lines per artifact type, not full /app"
  - "Production compose: restart+healthcheck+resource limits on every service"

requirements-completed:
  - SC-4
  - SC-5

duration: 2min
completed: "2026-04-13"
---

# Phase 14 Plan 02: Docker Optimization & Production Compose Summary

**Dockerfile.api optimized with targeted runner copies + pnpm prune, docker-compose.prod.yml created with restart policies, health checks on all 4 services, resource limits, and required secret enforcement**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T12:18:49Z
- **Completed:** 2026-04-13T12:20:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Dockerfile.api runner stage now copies only production-needed files (dist/, package.json, node_modules, packages/, prisma/) instead of the entire /app directory
- Added `pnpm prune --prod --config.ignore-scripts=true` to builder stage to remove devDependencies before the runner copies them
- Documented the Playwright/Chromium ~1.4GB image size as an architectural constraint (web image still meets 200MB target)
- Created docker-compose.prod.yml with all production hardening: restart policies, health checks on all services (including web which lacked one in dev), resource limits, logging rotation, and no insecure defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: Optimize Dockerfile.api runner stage** - `ba00cdc` (feat)
2. **Task 2: Create docker-compose.prod.yml** - `675c459` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `Dockerfile.api` - Runner stage now uses targeted COPY lines; builder stage adds pnpm prune --prod; Chromium size constraint documented
- `docker-compose.prod.yml` - New production compose: restart policies, health checks on all 4 services, deploy.resources.limits, json-file logging, DB_PASSWORD+AUTH_JWT_SECRET required, postgres/redis no host ports

## Decisions Made

- API image cannot meet 200MB due to Playwright/Chromium (~1.4GB) — this is an architectural constraint documented in the Dockerfile comment. The web image (alpine-based with Next.js standalone output) meets the 200MB target.
- `DB_PASSWORD` and `AUTH_JWT_SECRET` use `${VAR:?message}` syntax in production compose — no insecure fallback defaults possible.
- postgres and redis have no `ports:` in production compose — only accessible via Docker internal network.
- `AUTH_DEV_MODE: "false"` in production compose — real Keycloak SAML auth enforced, not JWT bypass.

## Deviations from Plan

None - plan executed exactly as written.

The plan specified both targeted COPY approach AND pnpm prune --prod. Both were implemented as specified. Docker compose validation confirmed via `docker compose -f docker-compose.prod.yml config --quiet` (with required vars set) exits with code 0.

## Issues Encountered

The `docker compose config --quiet` without required vars set exits with code 1 (expected: the `${DB_PASSWORD:?}` syntax correctly rejects missing required variables). Validated with `DB_PASSWORD=test AUTH_JWT_SECRET=test-secret-32-chars-minimum-ok` set — exits 0.

## User Setup Required

For production deployment, operators must set:
- `DB_PASSWORD` — PostgreSQL password (required, no default)
- `AUTH_JWT_SECRET` — JWT signing secret, minimum 32 characters (required, no default)
- `FRONTEND_URL` — public URL of the web frontend (optional, defaults to localhost:3000)
- `NEXT_PUBLIC_API_URL` — public URL of the API (optional, defaults to localhost:3001)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` — email sending config (optional)

## Next Phase Readiness

- Dockerfile.api and docker-compose.prod.yml ready for CI/CD integration (Plan 14-03)
- CI pipeline can use `docker compose -f docker-compose.prod.yml build` to validate images
- Both images build successfully; web meets 200MB target, API size documented as constraint

---
*Phase: 14-backend-hardening-containerization*
*Completed: 2026-04-13*
