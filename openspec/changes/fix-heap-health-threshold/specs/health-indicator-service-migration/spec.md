## MODIFIED Requirements

### Requirement: The /health Response Contract MUST Be Preserved

The `/health/ready` endpoint MUST keep its existing response contract: the
aggregated result keys (`database`, `redis`, `bullmq`, `memory_heap`), the
up/down status semantics, and the 200-when-healthy / 503-when-any-down HTTP
behavior MUST be unchanged.

The `/health/live` endpoint MUST NOT include a heap check. Liveness is a
process-aliveness probe; it MUST return only the HTTP 200 / 503 signal based
on whether the NestJS application itself is responding, with no `memory_heap`
key in the response payload. Removing the heap check from liveness eliminates
spurious DOWN responses and Docker restart loops caused by normal-load heap
usage exceeding the previously hardcoded 200 MB limit.

The heap threshold used by `/health/ready`'s `memory_heap` check MUST be
read from the `HEAP_HEALTH_THRESHOLD_BYTES` environment variable (validated
and typed via `EnvConfig`) rather than hardcoded, so the threshold can stay
aligned with the container memory limit without a code change.

#### Scenario: Readiness aggregates a down indicator

- **WHEN** any of the prisma, redis, or bullmq checks reports `down`
- **THEN** `/health/ready` resolves to an unhealthy aggregate
- **AND** the endpoint returns HTTP 503

#### Scenario: Readiness heap check uses the env threshold

- **GIVEN** `HEAP_HEALTH_THRESHOLD_BYTES` is set to a value lower than the
  current process heap usage
- **WHEN** `/health/ready` runs its heap check
- **THEN** the `memory_heap` indicator reports `down`
- **AND** the endpoint returns HTTP 503

#### Scenario: Liveness MUST NOT include a heap check

- **WHEN** `/health/live` is called
- **THEN** the response payload does NOT contain a `memory_heap` key
- **AND** the endpoint returns HTTP 200 when the process is alive regardless
  of heap usage

## ADDED Requirements

### Requirement: Heap Threshold MUST Be Environment-Configurable

The system SHALL read the heap health threshold from the
`HEAP_HEALTH_THRESHOLD_BYTES` environment variable, validated as a positive
integer via `envSchema` in
`apps/api/src/infrastructure/config/env.schema.ts`.

The default value SHALL be `1_610_612_736` bytes (1 536 MiB, approximately
75 % of the 2 GiB container memory limit declared in
`docker-compose.prod.yml`). This ensures that a freshly deployed instance
without an explicit override does not trigger false-positive DOWN responses.

The variable MUST be documented in `.env.example` with the default value and
a comment explaining how to calibrate it to the actual container limit.

`HealthController` MUST receive the threshold via injected `EnvConfig` rather
than reading `process.env` directly, so the value is always coerced, validated,
and typed before use.

#### Scenario: Default threshold prevents false positives under normal load

- **GIVEN** `HEAP_HEALTH_THRESHOLD_BYTES` is not set in the environment
- **WHEN** the API boots and `/health/ready` runs its heap check
- **THEN** the effective threshold is 1 536 MiB
- **AND** the `memory_heap` indicator reports `up` when heap usage is below
  that limit

#### Scenario: Operator overrides threshold for a smaller container

- **GIVEN** `HEAP_HEALTH_THRESHOLD_BYTES=536870912` (512 MiB) is set in the
  environment
- **WHEN** `/health/ready` runs its heap check
- **THEN** the effective threshold is 512 MiB
- **AND** the controller does not use the 200 MB or 1 536 MiB values
