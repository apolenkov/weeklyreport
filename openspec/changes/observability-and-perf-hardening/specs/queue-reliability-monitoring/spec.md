## ADDED Requirements

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

The `telegram-outbound` queue MUST be included in the monitored `QUEUE_NAMES`,
and the telegram worker's failed handler MUST increment
`cr_dlq_failed_total{queue="telegram-outbound"}` when a job exhausts its
retries, so telegram terminal failures contribute to the DLQ counter and the
alert threshold instead of being invisible. Until the telegram feature is
active (Phase 55), the activation point MUST carry a `TODO(Phase 55)` trace per
the deferred-feature convention.

#### Scenario: A terminal telegram failure increments the DLQ counter

- **GIVEN** a `telegram-outbound` job that has exhausted its retry attempts
- **WHEN** the worker's failed handler runs
- **THEN** `cr_dlq_failed_total{queue="telegram-outbound"}` increments
- **AND** that failure is eligible to trip the DLQ alert threshold

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
