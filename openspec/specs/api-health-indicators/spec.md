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

- **WHEN** both required in-process workers report ready and both BullMQ queue
  count probes succeed
- **THEN** the `up` result carries `pdf_export` and `email_reminder` objects
  with their `waiting` and `active` counts
- **AND** a queue failure or timeout produces a `down` result without exposing
  raw dependency error details

### Requirement: BullMQ readiness includes required worker lifecycle

`BullMQHealthIndicator` MUST read the current lifecycle of the required
`pdf-export` and `email-reminder` workers from the application-scoped BullMQ
registry. Queue connectivity alone MUST NOT report readiness. A missing,
starting, paused, stopped, or connection-unready worker produces `down`; the
indicator returns to `up` only after both current worker instances report ready
and the queue probes succeed. A stale event from a replaced worker MUST NOT
change the current worker state.

#### Scenario: Redis remains up after a worker stops

- **WHEN** queue count reads would succeed but either required worker is stopped
  or connection-unready
- **THEN** BullMQ readiness reports `down` and `/health/ready` returns HTTP 503

#### Scenario: A required worker reconnects or is replaced

- **WHEN** the current stopped or unready worker reports ready again, or a
  replacement worker registers and reports ready
- **THEN** BullMQ readiness recovers to `up` after both queue probes succeed

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

- **WHEN** the API process exists but one or both required workers have not yet
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
