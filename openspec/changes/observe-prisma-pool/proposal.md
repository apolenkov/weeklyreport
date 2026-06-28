## Why

The `pg.Pool` instance in `PrismaService` has no error-event listener.
When an idle pool client hits a connection error, the `pg` library emits
an unhandled `error` event that can crash the Node.js process with no
structured log entry. Additionally, the pool is created with no `max`,
`idleTimeoutMillis`, or `connectionTimeoutMillis` overrides, so its
size and timeout behaviour are invisible and untunable across environments.
Finding P1-21 from the 2026-06-28 repo-excellence review.

## What Changes

- Register a `pool.on('error', ...)` listener in `PrismaService` that
  routes idle-client errors to the NestJS `Logger` at error level with a
  structured JSON payload (`{ phase: 'pg.pool.error', message }`).
- Add three optional env vars read during `PrismaService` construction:
  - `DB_POOL_MAX` — maximum pool connections (default: `10`).
  - `DB_POOL_IDLE_TIMEOUT_MS` — idle client eviction timeout in ms
    (default: `10000`).
  - `DB_POOL_CONNECTION_TIMEOUT_MS` — acquire-from-pool timeout in ms
    (default: `0`, disabled).
- Parse each var with a `parseInt` + fallback; validate at boot and log
  the resolved values so operators can confirm the active configuration.
- No schema change, no migration, no tRPC procedure change.

## Capabilities

### New Capabilities

- `prisma-pool-observability`: Pool idle-error routing to structured logs
  and env-driven pool size / timeout configuration in `PrismaService`.

### Modified Capabilities

<!-- none — no existing spec governs PrismaService pool configuration -->

## Impact

- `apps/api/src/infrastructure/prisma/prisma.service.ts` — sole edit site.
- `.env.example` — add `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`,
  `DB_POOL_CONNECTION_TIMEOUT_MS` with commented defaults.
- `.env.test.example` — same three vars.
- No changes to shared schemas, tRPC procedures, migrations, or web.

## Non-goals

- Prometheus metrics for pool utilisation (a separate concern).
- Pool connection retry / circuit-breaker logic.
- Any change to `DATABASE_URL` or `DIRECT_URL` handling.
- Any change outside `prisma.service.ts` in the api layer.
