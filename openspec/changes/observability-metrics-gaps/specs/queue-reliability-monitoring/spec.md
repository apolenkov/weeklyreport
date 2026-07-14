## ADDED Requirements

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
This count is currently computed via `getFailedCount()` only for the
threshold-log comparison; exporting it lets an alerting rule threshold
against the authoritative value rather than only the
accumulate-since-restart counter.

#### Scenario: The DLQ monitor restarts mid-incident

- **WHEN** the DLQ monitor process restarts while failed jobs already exist
  in a queue's failed set
- **THEN** the authoritative gauge (`cr_dlq_failed_current` or equivalent)
  reflects the true failed-job count on the next poll after restart
- **AND** this value does not depend on `QueueEvents` having been subscribed
  at the moment each job failed

### Requirement: A queue health probe MUST be bounded by a timeout

`BullMQHealthIndicator.isHealthy` MUST NOT await `getJobCounts()` (or any Redis-backed probe) unboundedly.
A wedged Redis connection MUST resolve the health check to `down()` within a
bounded timeout rather than hanging `/health/ready`.

#### Scenario: Redis is unresponsive during a health check

- **WHEN** the underlying Redis connection is wedged and `getJobCounts()`
  never resolves or rejects
- **THEN** `isHealthy` resolves `down()` within the configured timeout bound
- **AND** `/health/ready` does not hang indefinitely as a result
