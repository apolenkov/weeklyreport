## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

Three pre-production hardening gaps were deliberately deferred and are now
recorded as `TODO`s in the deploy layer, but nothing tracks them to
completion:

- Caddy ships `Content-Security-Policy-Report-Only` with no `report-uri` —
  it is the only CSP layer, enforces nothing, and collects nothing. A
  malicious inline script or an exfiltrating `connect-src` target is not
  blocked, only silently unlogged.
- The auth/trpc/vitals rate limiters (`rate-limit.middleware.ts`) use
  `express-rate-limit`'s per-process `MemoryStore`. The 5/min auth
  brute-force window resets on every restart and, if the API is ever scaled
  to more than one replica, multiplies by replica count — an attacker gets
  `5 × N` attempts instead of 5.
- Base images across both Dockerfiles and `docker-compose.prod.yml` are
  pinned by mutable tag (`node:25-alpine`,
  `mcr.microsoft.com/playwright:v1.59.1-noble`, `postgres:15-alpine`,
  `edoburu/pgbouncer:1.22.1-p2`, `redis:7-alpine`, `caddy:2.8-alpine`), so a
  registry-side tag repush changes what a rebuild deploys with no signal in
  the diff.

Phase-A adversarial verification separately checked the related BL-21
finding ("Dockerfile.web bakes dev-auth defaults into the prod bundle") and
**refuted** the claimed bypass: a production `next build` inlines
`NODE_ENV=production`, and `webEnv.authStub()` / `webEnv.devRoleSwitcher()`
already fold `&& !isProduction()` before returning — the ARG default cannot
reach a live auth bypass in a real production build, and
`AUTH_DEV_MODE=true` is separately refused at API boot when
`NODE_ENV=production`. Flipping the Dockerfile ARG defaults to the safe
values is folded into slice 3 below as defense-in-depth hygiene, not as a
vulnerability fix.

## What Changes

Three independently committable slices.

**Slice 1 — CSP: Report-Only → enforcing**

- `deploy/caddy/Caddyfile`: add a `report-uri`/`report-to` target and flip
  `Content-Security-Policy-Report-Only` to an enforcing
  `Content-Security-Policy` header once the reported violations from the
  Report-Only window are clear (the header value's directives are otherwise
  unchanged: `default-src 'self'; img-src 'self' data:; style-src 'self'
'unsafe-inline'; connect-src 'self'`).

**Slice 2 — rate limiters: MemoryStore → Redis-backed**

- `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts`: back
  `authLimiter`, `trpcLimiter`, and `vitalsLimiter` with a shared Redis
  store (`rate-limit-redis` over the existing `ioredis` client) instead of
  `express-rate-limit`'s default in-memory store, so the limit window
  survives a process restart and is shared across replicas.
- The new Redis client for the store obtains its `host`/`port` from
  `buildRedisConnectionOptions(env)` — the same single builder every other
  Redis consumer uses — rather than reading `process.env` directly.

**Slice 3 — image digest pinning + BL-21 ARG-default hygiene**

- Pin every `FROM` in `Dockerfile.web` and `Dockerfile.api`, and every
  `image:` in `docker-compose.prod.yml`, to an `@sha256:<digest>` alongside
  the existing tag (`node:25-alpine`, `mcr.microsoft.com/playwright`,
  `postgres:15-alpine`, `edoburu/pgbouncer:1.22.1-p2`, `redis:7-alpine`,
  `caddy:2.8-alpine`). Digests are resolved at implementation time via
  `docker buildx imagetools inspect <image>:<tag>` (no registry access from
  this authoring session).
- `Dockerfile.web`: flip `ARG NEXT_PUBLIC_AUTH_STUB` and
  `ARG NEXT_PUBLIC_DEV_ROLE_SWITCHER` defaults from `true` to `false`, so an
  un-argumented build (direct `docker build`, CI, a base
  `docker-compose.yml` without explicit `build.args`) fails safe. Dev
  (`docker-compose.yml`) and prod (`docker-compose.prod.yml`) already pass
  explicit `build.args` and are unaffected.

Deploy-ordering note: this change is the deploy magnet in the current
backlog and lands **last** among all deploy-touching changes (after
`sync-playwright-prod-image`, the Caddy change, tracing, and healthchecks),
so its Caddyfile/Dockerfile/compose edits apply on top of theirs.
