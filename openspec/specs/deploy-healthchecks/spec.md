# deploy-healthchecks Specification

## Purpose

Define dependency-aware production Kubernetes probes and standalone image healthchecks so unhealthy workloads cannot serve traffic while startup and liveness remain correctly bounded.

## Requirements

### Requirement: PgBouncer Healthcheck MUST Exercise the Query Path

The production Helm chart's pgbouncer readiness and liveness probes MUST execute a real query against the configured application database through pgbouncer's own listener (`127.0.0.1:5432`). A failed or timed-out query MUST fail the probe even when TCP connections succeed. A TCP-only check MUST NOT be the sole healthcheck.

#### Scenario: PgBouncer can reach Postgres

- **WHEN** the pgbouncer readiness probe queries through `127.0.0.1:5432` successfully
- **THEN** Kubernetes can mark the container Ready

#### Scenario: Postgres is unreachable through pgbouncer

- **WHEN** a query through pgbouncer fails or times out while its TCP listener still accepts connections
- **THEN** readiness and liveness probes fail
- **AND** the container is not Ready

### Requirement: API deployment and image healthchecks exercise readiness with a startup budget

`Dockerfile.api`'s baked `HEALTHCHECK` and the Helm API startup and readiness probes MUST use `/health/ready`. The baked start period and Helm startup failure budget MUST each allow at least 60 seconds for bootstrap. Kubernetes liveness MUST use `/health/live` so dependency failures do not restart a live process.

#### Scenario: Standalone container without reachable dependencies

- **WHEN** the API image runs standalone without reachable Postgres or Redis past its healthcheck start period
- **THEN** its baked healthcheck reports unhealthy because readiness fails its database, Redis, or BullMQ checks
- **AND** process liveness alone cannot report the image healthy

#### Scenario: Kubernetes container during bootstrap

- **WHEN** the API container starts after migration and is completing bootstrap within its startup failure budget
- **THEN** startup probing protects it from premature liveness restarts
- **AND** the workload does not receive traffic until readiness succeeds

### Requirement: The PDF renderer healthcheck exercises its real health endpoint

The production Helm chart's gotenberg readiness and liveness probes MUST exercise the renderer's real `GET /health` endpoint and fail when it fails or times out. A bare TCP or process-liveness check MUST NOT be the sole healthcheck.

#### Scenario: Renderer health endpoint is exercised

- **WHEN** gotenberg readiness probing receives a successful `GET /health` response
- **THEN** Kubernetes can mark the renderer container Ready

#### Scenario: Renderer health endpoint fails

- **WHEN** the renderer's `GET /health` fails or times out
- **THEN** Kubernetes readiness probing fails

### Requirement: The API has no startup dependency on the renderer

The production Helm API workload MUST NOT wait for renderer readiness during startup, and no local development process MAY gate API startup on the renderer. The
renderer is a runtime-optional capability, not a startup dependency — the API
never contacts it during boot, so a startup edge would declare an ordering that
does not exist and would invite drift toward health-gated startup.
Boot validation of `GOTENBERG_URL` MUST be syntactic only: the variable
must exist and parse as a URL, and the API MUST NOT perform DNS or
reachability checks against it. A cold API start with the renderer
stopped, undeployed, or — under host-source `pnpm dev` — unresolvable MUST
succeed, with the outage visible only on the dedicated renderer health
signal and in retryable export failures, matching the non-gating
`api-health-indicators` contract.

#### Scenario: API boots with the renderer absent

- **GIVEN** the renderer service is stopped or undeployed
- **WHEN** the API container starts
- **THEN** it reaches `/health/ready` `up` on its own dependency set
- **AND** the dedicated renderer health signal reports `down`
- **AND** a PDF export attempt fails retryably rather than blocking the boot
