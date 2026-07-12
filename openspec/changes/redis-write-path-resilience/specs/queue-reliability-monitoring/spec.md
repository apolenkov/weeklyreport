## ADDED Requirements

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
