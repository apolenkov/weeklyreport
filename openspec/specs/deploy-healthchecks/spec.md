# deploy-healthchecks Specification

## Purpose

Docker healthchecks for the production API must exercise the real dependency
path, not just TCP/process liveness, so an unhealthy container is detected
before it serves traffic.

## Requirements

### Requirement: PgBouncer Healthcheck MUST Exercise the Query Path

The pgbouncer service's `docker-compose.prod.yml` healthcheck MUST execute
a real query against the `customreport` database through pgbouncer's own
listener (`127.0.0.1:5432`) and MUST report unhealthy when that query
fails or times out, even if pgbouncer's TCP listener still accepts
connections. A bare `pg_isready`-style TCP-only probe MUST NOT be used as
the sole healthcheck.

#### Scenario: PgBouncer can reach Postgres

- **WHEN** the pgbouncer healthcheck runs and the query through
  `127.0.0.1:5432` returns successfully
- **THEN** Docker reports the pgbouncer container `healthy`

#### Scenario: Postgres is unreachable through pgbouncer

- **WHEN** Postgres is overloaded, misconfigured, or its pool is exhausted,
  such that a query routed through pgbouncer fails or times out, while
  pgbouncer's own TCP listener still accepts connections
- **THEN** the pgbouncer healthcheck fails
- **AND** Docker reports the pgbouncer container `unhealthy` rather than
  `healthy`

### Requirement: The API Image's Baked Healthcheck MUST Match Its Compose Override

`Dockerfile.api`'s baked `HEALTHCHECK` instruction MUST target the same
`/health/ready` endpoint and MUST use a `--start-period` no shorter than
`docker-compose.prod.yml`'s `api` service healthcheck override, so a
standalone `docker run` of the image is checked as deeply as a
compose-orchestrated container and is not marked healthy on liveness alone
during its own startup window.

#### Scenario: Standalone container without reachable dependencies

- **WHEN** the api image runs standalone (no `docker compose`, no linked
  Postgres/Redis) past its healthcheck `start-period`
- **THEN** the baked `HEALTHCHECK` reports the container `unhealthy`,
  because `/health/ready` fails its database/Redis/BullMQ checks
- **AND** it does not report `healthy` on process-alive/memory checks alone

#### Scenario: Compose-orchestrated container during bootstrap

- **WHEN** the api container starts under `docker-compose.prod.yml` and is
  still completing migration and tRPC bootstrap within the tuned
  `start_period`
- **THEN** the healthcheck does not flip the container to `unhealthy`
  before that window elapses
