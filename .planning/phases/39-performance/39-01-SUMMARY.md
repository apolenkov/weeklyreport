# Phase 39, Plan 01 — SUMMARY

**REQ-IDs:** PERF-01
**Status:** complete

## What shipped

- `docker-compose.prod.yml` — added `pgbouncer` service (`edoburu/pgbouncer:1.22.1-p2`):
  - transaction mode, default pool 20, reserve pool 5, max client connections 100 (all overridable via `PGBOUNCER_*` env)
  - SCRAM-SHA-256 authentication (matches postgres 15 default)
  - depends_on `postgres` healthy; healthchecks via `pg_isready` on the bouncer's own port
  - 128M memory limit, json-file logging with rotation, restart unless-stopped
- `docker-compose.prod.yml` — api `DATABASE_URL` rerouted to `pgbouncer:5432` (with `?pgbouncer=true&connection_limit=1` query string as documentation of intent — Prisma 7's PrismaPg adapter ignores those flags, but they're harmless and signal intent for future tooling).
- `docker-compose.prod.yml` — migrate init-container's `DATABASE_URL` kept on `postgres:5432` directly (transaction-pooled bouncers can't run DDL safely). Both `DATABASE_URL` and `DIRECT_URL` set on the migrate service so any future Prisma config changes still wire correctly.
- `docker-compose.prod.yml` — api `depends_on` now includes `pgbouncer: condition: service_healthy` alongside the existing migrate + redis dependencies.
- `.env.example` — comment block documents the prod wiring: api → pgbouncer, migrate → postgres direct. Notes that Prisma 7 reads `DATABASE_URL` from `process.env` via the pg-pool adapter (no schema-side `directUrl` needed in v7).

## Why no schema.prisma change

Prisma 7 removed `url` and `directUrl` from `datasource` blocks (errors `P1012`). Connection URLs live in `prisma.config.ts` for the migrate command and in `process.env.DATABASE_URL` for the runtime PrismaClient (the latter is read directly by `apps/api/src/infrastructure/prisma/prisma.service.ts` when constructing the `pg.Pool` for the PrismaPg adapter). That gives us per-container URL routing for free — the api process sees pgbouncer, the migrate process sees postgres direct.

## Verification (deferred — needs prod stack running)

```bash
DB_PASSWORD=pw AUTH_JWT_SECRET=$(openssl rand -hex 32) ... \
docker compose -f docker-compose.prod.yml up -d

# pgbouncer is up
docker compose -f docker-compose.prod.yml exec pgbouncer pg_isready -h 127.0.0.1 -p 5432

# api connected through it
docker compose -f docker-compose.prod.yml exec postgres psql -U customreport -c \
  "SELECT application_name, count(*) FROM pg_stat_activity WHERE usename='customreport' GROUP BY application_name"
# expect ~20 active backends from pgbouncer (regardless of how many api workers / clients)

# pool stats from pgbouncer
docker compose -f docker-compose.prod.yml exec pgbouncer psql -h 127.0.0.1 -p 5432 -U customreport pgbouncer -c "SHOW POOLS"
```

## Files

- `docker-compose.prod.yml` (pgbouncer service + api/migrate URL routing)
- `.env.example` (prod-wiring comment block)
