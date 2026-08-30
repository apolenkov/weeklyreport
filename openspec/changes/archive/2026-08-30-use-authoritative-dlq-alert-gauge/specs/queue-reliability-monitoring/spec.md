## MODIFIED Requirements

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
