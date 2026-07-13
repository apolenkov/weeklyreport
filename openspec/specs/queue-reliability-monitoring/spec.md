# queue-reliability-monitoring Specification

## Purpose

TBD - created by archiving change observability-and-perf-hardening. Update Purpose after archive.

## Requirements

### Requirement: DLQ alert threshold survives a misconfigured env value

The DLQ monitor MUST parse `DLQ_ALERT_THRESHOLD` defensively: a value that is
not a finite number MUST fall back to the documented default and emit a warn log
naming the offending value, so a typo never silently disables the DLQ alert by
producing a `NaN` comparison.

#### Scenario: Unparseable threshold falls back and warns

- **GIVEN** `DLQ_ALERT_THRESHOLD` is set to a non-numeric string
- **WHEN** the DLQ monitor reads the threshold at startup
- **THEN** it uses the default threshold instead of `NaN`
- **AND** it emits a warn log identifying the invalid value

#### Scenario: Valid threshold is honored

- **GIVEN** `DLQ_ALERT_THRESHOLD` is set to a finite numeric string
- **WHEN** the DLQ monitor reads the threshold
- **THEN** it uses that parsed numeric value and alerts when the failed-job
  count exceeds it

### Requirement: Telegram terminal failures count toward DLQ metrics

The `telegram-outbound` queue MUST be included in the monitored `QUEUE_NAMES`
so the existing DLQ monitor increments
`cr_dlq_failed_total{queue="telegram-outbound"}` exactly once per terminal
failure via its `QueueEvents` listener, the same single-owner path it already
uses for `email-reminder` and `pdf-export`. The change MUST NOT add a second
increment from a telegram worker handler, which would double-count. Because
telegram is a Phase 55 deferred feature, the `QUEUE_NAMES` entry — the new
activation point — MUST carry a `TODO(Phase 55)` trace per the deferred-feature
convention.

#### Scenario: A terminal telegram failure increments the DLQ counter once

- **GIVEN** `telegram-outbound` is in the monitored `QUEUE_NAMES`
- **AND** a `telegram-outbound` job that has exhausted its retry attempts
- **WHEN** the DLQ monitor observes the terminal failure via `QueueEvents`
- **THEN** `cr_dlq_failed_total{queue="telegram-outbound"}` increments exactly
  once, with no second increment from any worker handler
- **AND** that failure is eligible to trip the DLQ alert threshold because the
  threshold poll iterates the same monitored queue set

#### Scenario: Telegram queue is part of the monitored set

- **GIVEN** the DLQ monitor enumerates the queues it watches
- **WHEN** it builds its monitored set
- **THEN** `telegram-outbound` is present alongside `email-reminder` and
  `pdf-export`

### Requirement: Bull Board queue handles close on shutdown

The two BullMQ `Queue` instances created for Bull Board MUST be lifecycle-managed
so they are closed during application shutdown, leaving no idle Redis connection
leaked after a graceful stop.

#### Scenario: Bull Board queues close on graceful shutdown

- **GIVEN** the application has started and created the Bull Board `Queue`
  instances
- **WHEN** the application shuts down gracefully
- **THEN** both Bull Board `Queue` instances are closed
- **AND** no idle Redis connection from them remains open

### Requirement: pdf-export and email-reminder jobs carry bounded retention

The `pdf-export` and `email-reminder` BullMQ queues MUST register
`defaultJobOptions` bounding both completed and failed job retention
(`removeOnComplete` and `removeOnFail` with a finite `count`), matching the
retention `telegram-outbound` already sets per-job, so completed and failed
job hashes do not accumulate in Redis without bound.

#### Scenario: Completed pdf-export jobs are pruned past the retention count

- **GIVEN** the `pdf-export` queue has `removeOnComplete: { count: 100 }`
  in its `defaultJobOptions`
- **WHEN** more than 100 jobs on that queue have completed
- **THEN** BullMQ prunes the oldest completed job hashes so at most 100
  remain in Redis

#### Scenario: Failed email-reminder jobs are pruned past the retention count

- **GIVEN** the `email-reminder` queue has `removeOnFail: { count: 500 }`
  in its `defaultJobOptions`
- **WHEN** more than 500 jobs on that queue have exhausted retries and
  terminally failed
- **THEN** BullMQ prunes the oldest failed job hashes so at most 500 remain
  in Redis

### Requirement: Redis memory usage is monitored and alerted on before the configured cap is reached

The API MUST poll Redis memory usage (`used_memory` from `INFO memory`) on
the same interval the DLQ monitor already uses, compare it against a
required `REDIS_MAXMEMORY_BYTES` env value with no fallback, expose the
current usage as a Prometheus gauge, and emit a structured warn log the
first time usage in a given poll crosses 80% of that configured cap. This
gives an operator visibility into the slow unbounded-growth failure mode
before Redis is OOM-killed by the container's memory limit.

#### Scenario: Usage below 80% of the cap stays quiet

- **GIVEN** `REDIS_MAXMEMORY_BYTES` is set to `209715200` (200mb)
- **AND** current Redis `used_memory` is below 80% of that value
- **WHEN** the monitor's poll interval elapses
- **THEN** the `redisMemoryUsedBytes` gauge is updated to the current value
- **AND** no warn log is emitted

#### Scenario: Usage crossing 80% of the cap emits a warn log

- **GIVEN** `REDIS_MAXMEMORY_BYTES` is set to `209715200` (200mb)
- **AND** current Redis `used_memory` is at or above 80% of that value
- **WHEN** the monitor's poll interval elapses
- **THEN** the `redisMemoryUsedBytes` gauge reflects the current usage
- **AND** a structured warn log identifies the current usage and the
  configured cap

#### Scenario: A missing REDIS_MAXMEMORY_BYTES fails boot loud

- **WHEN** `validateEnv()` runs with `REDIS_MAXMEMORY_BYTES` unset
- **THEN** validation fails and `validateEnv()` calls `process.exit(1)`
  rather than returning a config with an inferred default
