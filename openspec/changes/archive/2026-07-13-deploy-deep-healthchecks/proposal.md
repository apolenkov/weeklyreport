## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`docker-compose.prod.yml`'s pgbouncer service is probed with
`pg_isready -h 127.0.0.1 -p 5432`, which only confirms pgbouncer's own TCP
listener accepts connections. It says nothing about whether pgbouncer can
actually reach and query Postgres through it. If Postgres is overloaded,
auth is misconfigured, or the pool is exhausted, `pg_isready` still reports
pgbouncer healthy while every Prisma query routed through it times out —
the api's own `/health/ready` can report UP under exactly this condition,
because pgbouncer being "up" is a precondition it trusts rather than
re-verifies end to end.

Separately, `Dockerfile.api`'s baked `HEALTHCHECK` instruction targets
`/health/live` (process-alive + memory only), while
`docker-compose.prod.yml` overrides it per-service to target `/health/ready`
(Postgres + Redis + BullMQ + memory). Compose-orchestrated containers are
therefore deep-checked, but a standalone `docker run` of the api image —
used for manual debugging or any non-compose deployment path — falls back
to the baked liveness-only check and can report healthy while unable to
serve a single database query. Reconciling the two probes on the same
endpoint fixes that gap; it also means a standalone container without its
dependencies reachable now correctly reports unhealthy at startup, which is
the intended behavior — the old baked check reported healthy under that
exact failure.

## What Changes

- `docker-compose.prod.yml`: replace the pgbouncer service's
  `pg_isready`-only healthcheck with a probe that executes a real query
  through pgbouncer's own listener (`127.0.0.1:5432`, not `postgres:5432`,
  so the check exercises the same path client traffic takes) against the
  `customreport` database, using whichever query-capable client is present
  in the `edoburu/pgbouncer:1.22.1-p2` image. The probe MUST fail when the
  query itself fails or times out, not merely when the TCP handshake
  succeeds.
- `Dockerfile.api`: change the baked `HEALTHCHECK` instruction's target
  from `/health/live` to `/health/ready`, matching the endpoint
  `docker-compose.prod.yml` already overrides it to at the service level.
  Bump the baked `--start-period` from `15s` to `60s` to match compose's
  tuned value — a shorter start-period would flap a standalone container
  through its normal migrate+bootstrap window, since readiness now depends
  on Postgres/Redis/BullMQ being reachable, not just the process being
  alive.
- The compose-level `healthcheck:` override on the `api` service stays in
  place (same endpoint as the new baked default, tuned intervals kept) —
  this change removes the divergence between the two, not the override
  itself.

## Impact

- `docker-compose.prod.yml` (pgbouncer healthcheck)
- `Dockerfile.api` (baked `HEALTHCHECK` instruction)

Non-goals: no change to the api service's compose-level healthcheck tuning
(interval/timeout/retries/start_period are already correct there); no
change to the `/health/live` or `/health/ready` endpoint implementations
(covered by the separate `health-indicator-service-migration` capability);
no change to postgres's or redis's own healthchecks.
