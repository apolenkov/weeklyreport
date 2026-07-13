## 1. Slice 1 — CSP: Report-Only → enforcing

- [ ] 1.1 Decide the `report-uri`/`report-to` collection target (existing
      Bugsink/Sentry endpoint or a dedicated `/csp-report` API route) and
      document the choice in the Caddyfile comment next to the directive
- [ ] 1.2 `deploy/caddy/Caddyfile`: add the chosen `report-uri`/`report-to`
      target to the existing directive set
- [ ] 1.3 Deploy with the header still `Content-Security-Policy-Report-Only`
      for one observation window; confirm the report endpoint receives
      violations and that no legitimate role surface trips a false positive
- [ ] 1.4 Flip the header name to `Content-Security-Policy` (enforcing);
      remove the now-stale `TODO: flip Report-Only -> enforcing` comment
- [ ] 1.5 Live-check each of the four role surfaces (lead, head, admin,
      viewer) loads with no console CSP violation

## 2. Slice 2 — rate limiters: MemoryStore → Redis-backed

- [ ] 2.1 Add `rate-limit-redis` to `apps/api/package.json` dependencies
- [ ] 2.2 `rate-limit.middleware.ts`: construct one shared `ioredis` client
      via `buildRedisConnectionOptions(env)` (no direct `process.env` read,
      no fallback host/port) and pass a `RedisStore` built from it as the
      `store` option on `authLimiter`, `trpcLimiter`, and `vitalsLimiter`
- [ ] 2.3 Keep the existing `TEST_MODE_LIMIT_PER_MINUTE` bump and the
      `isTest` in-memory path for E2E — E2E does not need the Redis store
      and must not require a live Redis for the unit suite
- [ ] 2.4 `redis-connection-config` spec: add the rate-limit store as a
      sixth named consumer of `buildRedisConnectionOptions` (see spec delta
      in section 4)
- [ ] 2.5 Verify a restart no longer resets the auth-limiter window: hit
      `/auth/dev-login` 5 times to trip the limiter, restart the API
      process, confirm the 6th request in the same window is still limited

## 3. Slice 3 — image digest pinning + dev-auth ARG-default hygiene

- [ ] 3.1 Resolve digests for each pinned image via
      `docker buildx imagetools inspect <image>:<tag>`: `node:25-alpine`,
      `mcr.microsoft.com/playwright:v1.59.1-noble`, `postgres:15-alpine`,
      `edoburu/pgbouncer:1.22.1-p2`, `redis:7-alpine`, `caddy:2.8-alpine`
- [ ] 3.2 `Dockerfile.web`: pin both `FROM node:25-alpine` lines (`base` and
      `runner` stages) to `node:25-alpine@sha256:<digest>`; remove the two
      `TODO: pin @sha256` comments
- [ ] 3.3 `Dockerfile.api`: pin
      `FROM mcr.microsoft.com/playwright:v1.59.1-noble` to
      `@sha256:<digest>`; remove the matching `TODO` comment
- [ ] 3.4 `docker-compose.prod.yml`: pin `postgres:15-alpine`,
      `edoburu/pgbouncer:1.22.1-p2`, `redis:7-alpine`, and `caddy:2.8-alpine`
      each to `@sha256:<digest>`
- [ ] 3.5 `Dockerfile.web`: flip `ARG NEXT_PUBLIC_AUTH_STUB=true` and
      `ARG NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` to `=false`; confirm
      `docker-compose.yml` (dev) and `docker-compose.prod.yml` still pass
      explicit `build.args` overriding both (dev to `"true"`, prod already
      `"false"`)
- [ ] 3.6 Build all three images (`web`, `api`, and confirm the pulled
      base images) and confirm the digest pin does not change build output
      versus the previous mutable-tag build

## 4. Spec delta

- [ ] 4.1 `prod-security-hardening` (new capability): ADD requirements for
      enforcing CSP with a report target and for `@sha256` digest pinning
      across both Dockerfiles and `docker-compose.prod.yml`, plus the
      dev-auth ARG-default hygiene requirement
- [ ] 4.2 `redis-connection-config`: MODIFY "Every Redis consumer MUST
      obtain host/port from the builder" to add the rate-limit store as a
      sixth named consumer

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 `docker compose -f docker-compose.prod.yml config` (validates the
      compose file parses with the pinned image references)
- [ ] 5.4 `openspec validate prod-security-hardening --strict`
- [ ] 5.5 Adversarial review of the diff (two independent reviewers) before
      archiving, given this change lands last among deploy-touching changes
