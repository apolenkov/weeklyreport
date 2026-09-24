# Spec Delta

## ADDED Requirements

### Requirement: PDF renderer health is a dedicated non-gating signal

The API MUST expose a dedicated `GET /health/pdf-renderer` endpoint that
probes the internal PDF renderer's own `GET /health` with a bounded timeout
(~2 s, aborting the fetch promptly and releasing response resources so a
lost race leaves no lingering socket) and reports `up`/`down` as HTTP
200/503, unauthenticated like the other health routes and without leaking
internal error details. The probe is
lazy: the API never contacts the renderer during boot, so an environment
where the configured renderer hostname cannot resolve (for example
host-source `pnpm dev`, whose `GOTENBERG_URL` points at the
compose-internal hostname) still starts normally. The renderer
probe MUST NOT join the `/health/ready` aggregate: a renderer outage leaves
`/health/ready` reporting the API's real dependency set (`database`,
`redis`, `bullmq`, `memory_heap`) and MUST NOT turn it to 503. A renderer
outage therefore degrades PDF export jobs — which fail retryably — without
marking the API unready.

#### Scenario: Renderer down, API still ready

- **GIVEN** the renderer service is unreachable, unhealthy, or not deployed
- **WHEN** `/health/pdf-renderer` and `/health/ready` are queried
- **THEN** `/health/pdf-renderer` reports `down` with HTTP 503
- **AND** `/health/ready` still aggregates only `database`, `redis`,
  `bullmq`, and `memory_heap`

#### Scenario: Renderer recovers

- **WHEN** the renderer's `GET /health` answers successfully again
- **THEN** `/health/pdf-renderer` reports `up` with HTTP 200
- **AND** no readiness state was regressed in between

#### Scenario: Host-source development without a reachable renderer

- **GIVEN** the API runs from host source (`pnpm dev`) with a valid
  `GOTENBERG_URL` whose hostname cannot resolve on the host
- **WHEN** the API boots and the health endpoints are queried
- **THEN** boot succeeds without contacting or resolving the renderer
- **AND** `/health/pdf-renderer` reports `down` with HTTP 503
- **AND** `/health/ready` still reports only its own dependency set
