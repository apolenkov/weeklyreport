## ADDED Requirements

### Requirement: Health Indicators MUST Use HealthIndicatorService

The three API health indicators MUST report through the non-deprecated
`HealthIndicatorService.check(key).up()/.down()` API and MUST NOT extend
the deprecated `HealthIndicator` base class or throw the deprecated
`HealthCheckError`. This applies to `PrismaHealthIndicator`
(`apps/api/src/infrastructure/health/prisma.health.ts`),
`RedisHealthIndicator` (`redis.health.ts`), and `BullMQHealthIndicator`
(`bullmq.health.ts`). `RedisHealthIndicator` MUST keep its
`OnModuleDestroy` ioredis-client ownership.

#### Scenario: Prisma indicator reports up

- **WHEN** `PrismaHealthIndicator.isHealthy("database")` runs and the
  `SELECT 1` probe succeeds
- **THEN** it returns a `HealthIndicatorResult` keyed `database` with
  status `up`
- **AND** it does so without calling `getStatus` or `HealthCheckError`

#### Scenario: Redis indicator reports down on a failed ping

- **WHEN** `RedisHealthIndicator.isHealthy("redis")` runs and
  `redis.ping()` rejects
- **THEN** it returns a `HealthIndicatorResult` keyed `redis` with status
  `down`
- **AND** it returns the result rather than throwing `HealthCheckError`

#### Scenario: BullMQ detail payload survives the migration

- **WHEN** `BullMQHealthIndicator.isHealthy("bullmq")` runs and both queue
  `getJobCounts()` calls succeed
- **THEN** the `up` result carries the `pdf_export` and `email_reminder`
  objects with their `waiting` and `active` counts unchanged
- **AND** on a queue failure the `down` result carries the `message` detail

### Requirement: The Health Module MUST Carry No no-deprecated Escape Hatch

The health module MUST contain no `eslint-disable
@typescript-eslint/no-deprecated` directive and no
`TODO(ratchet-no-deprecated)` marker after the migration. This covers the
per-site disables in `prisma.health.ts` and `bullmq.health.ts` and the
file-level block disable at `redis.health.ts:1`. The strict
`@typescript-eslint/no-deprecated: error` rule
(`eslint.config.ts:273-274`) MUST stay green without any health
suppression.

#### Scenario: Linting the health module after migration

- **WHEN** `pnpm lint` runs over
  `apps/api/src/infrastructure/health/*.health.ts`
- **THEN** it passes with no `no-deprecated` suppression present in any of
  the three files
- **AND** no `TODO(ratchet-no-deprecated)` marker remains in the module

### Requirement: The /health Response Contract MUST Be Preserved

The `/health/ready` and `/health/live` endpoints MUST keep their existing
response contract through the migration. The aggregated result keys
(`database`, `redis`, `bullmq`, `memory_heap`), the up/down status
semantics, and the 200-when-healthy / 503-when-any-down HTTP behavior MUST
be unchanged. The controller's `HealthCheckService.check([...])` wiring
(`apps/api/src/infrastructure/health/health.controller.ts:22-39`) MUST be
unchanged.

#### Scenario: Readiness aggregates a down indicator

- **WHEN** any of the prisma, redis, or bullmq checks reports `down`
- **THEN** `/health/ready` resolves to an unhealthy aggregate
- **AND** the endpoint returns HTTP 503 as it did before the migration

#### Scenario: Liveness is unaffected

- **WHEN** `/health/live` runs its memory-heap check
- **THEN** it returns the same `memory_heap` result and HTTP status as
  before the migration
- **AND** no health indicator construction outside the three migrated
  classes is changed
