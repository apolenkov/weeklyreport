# queue-reliability-monitoring Specification

## Purpose

Define queue failure, retention, depth, and Redis-capacity signals without
duplicated counters, silent configuration recovery, or leaked connections.

## Requirements

### Requirement: DLQ alert threshold rejects a misconfigured env value

The environment boundary MUST reject a configured `DLQ_ALERT_THRESHOLD` that is
not a positive integer. Omitting the optional value uses the documented named
consumer default; supplying an invalid value MUST fail boot rather than recover.

#### Scenario: Unparseable threshold fails validation

- **GIVEN** `DLQ_ALERT_THRESHOLD` is set to a non-numeric string
- **WHEN** `validateEnv()` parses the environment at startup
- **THEN** validation fails before the DLQ monitor starts
- **AND** no inferred threshold is returned

#### Scenario: Valid threshold is honored

- **GIVEN** `DLQ_ALERT_THRESHOLD` is set to a finite numeric string
- **WHEN** the DLQ monitor reads the threshold
- **THEN** it uses that parsed numeric value and alerts when the failed-job
  count exceeds it

### Requirement: Bull Board queue handles close on shutdown

Every BullMQ `Queue` instance created for Bull Board MUST be lifecycle-managed
so it is closed during application shutdown, leaving no idle Redis connection
leaked after a graceful stop.

#### Scenario: Bull Board queues close on graceful shutdown

- **GIVEN** the application has started and created the Bull Board `Queue`
  instances
- **WHEN** the application shuts down gracefully
- **THEN** every Bull Board `Queue` instance is closed
- **AND** no idle Redis connection from them remains open

### Requirement: registered jobs carry bounded retention

Every BullMQ queue registered in `QueueRegistry` MUST register
`defaultJobOptions` bounding both completed and failed job retention
(`removeOnComplete` and `removeOnFail` with a finite `count`), so completed and
failed job hashes do not accumulate in Redis without bound.

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

### Requirement: head queue investigation covers every monitored queue

The head queue surfaces MUST expose every queue in `QueueRegistry` for
failed-job investigation. The in-app typed list, retry, and remove commands
MUST use the canonical `headProcedure` middleware rather than the admin-only or
any-role chain, and MUST accept only the canonical queue-name contract. Bull
Board remains restricted to a literal `head` role. Returned metadata MUST
exclude processor payloads, credentials, recipient addresses, and report
content.

Reminder-execution existence checks MUST run only for `email-reminder` jobs.
An `executionId` in any other queue belongs to that queue's own domain and MUST
NOT cause the failed job to be removed as a stale reminder.

#### Scenario: A head investigates any monitored queue

- **GIVEN** a failed job exists in `pdf-export`, `ai-provider-test`, or
  `semantic-index`
- **WHEN** a head lists, retries, or removes the failed job
- **THEN** the action targets only that named queue and opaque job id
- **AND** the response contains allowlisted failure metadata only

#### Scenario: The Jobs tab opens on a queue that has failures

- **GIVEN** the failed-job count is non-zero and only `pdf-export` holds failures
- **WHEN** an admin opens the Jobs tab of the Admin Panel
- **THEN** the queue selector starts on `pdf-export`, not on an empty
  `email-reminder`, and a later count refresh does not move it
- **AND** the failed-job count read (`admin.dlqCount`, admin-only like the tab)
  carries the per-queue split that drives the choice; when it is unavailable the
  selector starts on `email-reminder`
- **AND** until the count read settles the list shows its loading state and never
  "Queue is clean"; a queue the admin picked meanwhile is kept

#### Scenario: A provider test execution id is not a reminder reference

- **GIVEN** a failed `ai-provider-test` job carries its provider-test
  `executionId`
- **WHEN** a head retries that job
- **THEN** the job is retried without querying `ReminderExecution`
- **AND** it is not removed as a stale reminder

#### Scenario: A non-head cannot operate the queue surface

- **WHEN** an unauthorized role calls the in-app queue API or a non-head opens
  Bull Board
- **THEN** authorization fails before queue data or mutation is read

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

### Requirement: A queue's job-count depth MUST be exported as a scraped gauge

Every BullMQ queue registered in `QueueRegistry` MUST have its waiting/active/delayed job counts exported as a Prometheus gauge.
The gauge MUST refresh on the DLQ monitor's existing poll interval, so a
stuck job (dead worker, Redis partition) that never exhausts its retry
budget is visible before it silently hangs a report.

#### Scenario: A job sits in the waiting state past a normal processing window

- **WHEN** a job for a registered queue remains in the `waiting` or `active`
  state across multiple poll cycles without completing or failing
- **THEN** the `cr_queue_depth{queue,state}` gauge reflects that count on
  the next scrape
- **AND** the value is not derived only from event-driven counters that
  could miss the stuck job entirely

### Requirement: The authoritative DLQ failed-job count MUST be exported as a gauge

The DLQ monitor's authoritative absolute failed-job count MUST be exported as a Prometheus gauge distinct from the event-driven rate counter.
The active failed-job alert consumed by operators MUST threshold this gauge rather than the accumulate-since-restart event counter.

#### Scenario: The DLQ monitor restarts mid-incident

- **WHEN** the DLQ monitor process restarts while failed jobs already exist
  in a queue's failed set
- **THEN** the authoritative gauge (`cr_dlq_failed_current` or equivalent)
  reflects the true failed-job count on the next poll after restart
- **AND** the active failed-job alert evaluates that authoritative gauge
- **AND** neither the gauge nor the alert depends on `QueueEvents` having been
  subscribed at the moment each job failed

#### Scenario: A job fails terminally before exhausting its retry budget

- **GIVEN** a `pdf-export` job configured with `attempts: 3` throws an
  unrecoverable error on its first attempt
- **WHEN** BullMQ publishes the terminal `failed` queue event
- **THEN** the event-driven failure counter (`cr_dlq_failed_total`) increments
  by one for that queue
- **AND** the failed job also appears in the authoritative failed-count gauge
  on the next poll
- **AND** ordinary retry transitions (`waiting`/`delayed`) never increment the
  counter

### Requirement: A queue health probe MUST be bounded by a timeout

`BullMQHealthIndicator.isHealthy` MUST NOT await `getJobCounts()` (or any Redis-backed probe) unboundedly.
A wedged Redis connection MUST resolve the health check to `down()` within a
bounded timeout rather than hanging `/health/ready`.

#### Scenario: Redis is unresponsive during a health check

- **WHEN** the underlying Redis connection is wedged and `getJobCounts()`
  never resolves or rejects
- **THEN** `isHealthy` resolves `down()` within the configured timeout bound
- **AND** `/health/ready` does not hang indefinitely as a result

### Requirement: Failed-job actions refresh the displayed list and count

After Retry or Remove returns successfully, the Jobs surface MUST invalidate the
failed-job list actually used by its infinite query and refresh the failed-job
count. The list MUST reflect the server's new result without a page reload. A
failed action MUST preserve its error feedback and MUST NOT imply success.
Existing queue selection, pagination, confirmation and authorization MUST remain
unchanged.

#### Scenario: Removing a failed job updates the list

- **GIVEN** a failed job is visible in the selected queue
- **WHEN** its confirmed removal succeeds and the list read completes
- **THEN** the removed row disappears and the failed-job count is refreshed

#### Scenario: Retrying a failed job updates the list

- **GIVEN** a failed job is visible in the selected queue
- **WHEN** retry succeeds and the queue no longer returns it as failed
- **THEN** the next list read removes that row and refreshes the count

#### Scenario: A retried pdf-export entry leaves the failed list

- **GIVEN** a failed `pdf-export` entry `${jobId}-g1` whose durable row accepts a retry
- **WHEN** a retry started from the failed list or the PDF recovery panel
  enqueues the fresh `${jobId}-g2` job
- **THEN** the superseded g1 entry is removed from the failed list and the
  failed-job count drops without a manual Remove
- **AND** a failure to remove it does not fail the retry

#### Scenario: A rejected action does not masquerade as success

- **WHEN** retry or removal fails
- **THEN** the existing failure feedback remains available and no success result
  is fabricated
