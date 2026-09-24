# Spec Delta

## ADDED Requirements

### Requirement: The PDF renderer healthcheck exercises its real health endpoint

The `gotenberg` service's `docker-compose.prod.yml` healthcheck MUST exercise
the renderer's real `GET /health` endpoint and MUST report unhealthy when
that endpoint fails or times out. A bare TCP/process-liveness check MUST NOT
be the sole healthcheck.

#### Scenario: Renderer health endpoint is exercised

- **WHEN** the gotenberg healthcheck runs and `GET /health` succeeds
- **THEN** Docker reports the renderer container `healthy`

#### Scenario: Renderer health endpoint fails

- **WHEN** the renderer's `GET /health` fails or times out
- **THEN** Docker reports the renderer container `unhealthy`

### Requirement: The API has no startup dependency on the renderer

The `api` service MUST NOT declare a `depends_on` edge on the renderer
service in any Compose file. Compose `depends_on` does offer an optional
mode (`required: false`, since Compose 2.20.0), but the renderer is a
runtime-optional capability, not a startup dependency — the API never
contacts it during boot, so even an optional edge would declare an ordering
that does not exist and would invite drift toward health-gated startup.
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
