# api-health-indicators Specification

## Purpose

Define the current API readiness and liveness probe results and their HTTP
contract.

## Requirements

### Requirement: Health probes return the canonical indicator result

`PrismaHealthIndicator`, `RedisHealthIndicator`, and `BullMQHealthIndicator`
MUST use the injected `HealthIndicatorService` to return a
`HealthIndicatorResult`. A successful probe returns `up`; a failed dependency
probe returns `down`. The Redis probe owns and disconnects its ioredis client on
module destruction.

#### Scenario: Dependency probes report their current state

- **WHEN** the Prisma `SELECT 1`, Redis `ping`, or BullMQ job-count probe runs
- **THEN** the corresponding result is keyed by the requested key and reports
  `up` on success or `down` on failure
- **AND** a failed probe returns a result that is safe for the unauthenticated
  health endpoint

#### Scenario: BullMQ result includes queue counts

- **WHEN** all four required in-process workers report ready and all four
  canonical BullMQ queue count probes succeed
- **THEN** the `up` result carries `pdf_export` and `email_reminder` objects
  with their `waiting` and `active` counts
- **AND** a queue failure or timeout produces a `down` result without exposing
  raw dependency error details, including errors whose text contains `timed out`
- **AND** a queue probe that does not settle produces `down` after 2 seconds

### Requirement: BullMQ readiness includes required worker lifecycle

`BullMQHealthIndicator` MUST read the current lifecycle of all four required
workers—`email-reminder`, `pdf-export`, `ai-provider-test`, and
`semantic-index`—from the application-scoped BullMQ registry. Queue
connectivity alone MUST NOT report readiness. A missing, starting, paused,
stopped, or connection-unready worker produces `down`; the indicator returns
to `up` only after all four current worker instances report ready and all four
queue probes succeed. A stale event from a replaced worker MUST NOT change the
current worker state.

#### Scenario: Redis remains up after a worker stops

- **WHEN** queue count reads would succeed but any required worker is stopped or
  connection-unready
- **THEN** BullMQ readiness reports `down` and `/health/ready` returns HTTP 503

#### Scenario: A required worker reconnects or is replaced

- **WHEN** the current stopped or unready worker reports ready again, or a
  replacement worker registers and reports ready
- **THEN** BullMQ readiness recovers to `up` after all four queue probes succeed

### Requirement: BullMQ readiness checks the exhaustive queue registry

`BullMQHealthIndicator` MUST obtain queue handles from the application-scoped
`QueueRegistry` and probe every name in the canonical `QUEUE_NAMES` tuple:
`email-reminder`, `pdf-export`, `ai-provider-test`, and `semantic-index`.
Readiness MUST be `down` if any one of those queue probes fails or times out.
The current `pdf_export` and `email_reminder` count fields remain supported;
successful results additionally expose the complete `queues` map keyed by the
canonical queue names, with only `waiting` and `active` counts.

#### Scenario: An auxiliary queue is unavailable

- **WHEN** the required workers are ready but any canonical queue's count probe
  fails or times out
- **THEN** BullMQ readiness reports `down`
- **AND** the response does not expose the raw queue error or job payload

#### Scenario: Workers are still connecting during startup grace

- **WHEN** the API process exists but one or more required workers have not yet
  reported ready
- **THEN** `/health/ready` remains unavailable while `/health/live` stays up
- **AND** the deployment healthcheck startup grace absorbs normal worker
  connection time instead of treating an unready worker as ready

### Requirement: Readiness and liveness expose stable HTTP semantics

`GET /health/ready` MUST aggregate the `database`, `redis`, `bullmq`, and
`memory_heap` results. It returns HTTP 200 when all checks are up and HTTP 503
when any check is down. `GET /health/live` MUST run the process liveness check and
does not include readiness dependency probes.

#### Scenario: Readiness aggregates a down indicator

- **WHEN** any readiness dependency reports `down`
- **THEN** `/health/ready` returns an unhealthy aggregate with HTTP 503

#### Scenario: Liveness remains independent

- **WHEN** `/health/live` runs
- **THEN** it returns the canonical liveness result and HTTP status without
  invoking readiness-specific indicators

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
cluster-internal hostname) still starts normally. The renderer
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
