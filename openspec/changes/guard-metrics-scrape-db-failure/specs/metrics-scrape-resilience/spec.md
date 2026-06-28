## ADDED Requirements

### Requirement: DB-backed gauge collect callbacks MUST NOT propagate errors into the scrape

The system SHALL wrap the Prisma query inside each DB-backed `Gauge.collect`
callback (`customreportReportsOnTimeRatio` and `customreportActiveLeadsTotal`,
wired in `TelemetryGauges.onModuleInit` at
`apps/api/src/modules/telemetry/telemetry.gauges.ts`) in a `try/catch` block.
When the query throws, the callback MUST catch the error, log it via the
injected `Logger`, and return without calling `Gauge.set()`, leaving the gauge
unset for that scrape cycle. The rejection MUST NOT escape the callback into
`Registry.metrics()`'s `Promise.all`, so the `/metrics` HTTP response MUST
still be produced even when one or both DB-backed gauges fail.

#### Scenario: DB failure during on-time-ratio collect leaves scrape intact

- **WHEN** `TelemetryGaugesPort.onTimeRatioLastNPeriods` throws during a scrape
- **THEN** `Registry.metrics()` still resolves successfully
- **AND** the scrape response includes the DB-independent metrics (heap,
  HTTP/tRPC latency, DLQ counters)
- **AND** `customreportReportsOnTimeRatio` is absent or emits its last-set
  value rather than causing a 500

#### Scenario: DB failure during active-leads collect leaves scrape intact

- **WHEN** `TelemetryGaugesPort.activeLeadsLastPublishedPeriod` throws during
  a scrape
- **THEN** `Registry.metrics()` still resolves successfully
- **AND** `customreportActiveLeadsTotal` is absent or emits its last-set value
  rather than causing a 500

#### Scenario: Both DB-backed gauges fail simultaneously

- **WHEN** both `onTimeRatioLastNPeriods` and `activeLeadsLastPublishedPeriod`
  throw in the same scrape cycle
- **THEN** `Registry.metrics()` still resolves successfully
- **AND** all DB-independent gauges and counters are included in the response

### Requirement: Collect callback DB errors MUST be logged at error level

The system SHALL log each caught DB error via the NestJS `Logger` injected
into `TelemetryGauges`, using `Logger.error`, before the callback returns.
The log message MUST identify which gauge's collect failed so the cause can
be correlated to the source.

#### Scenario: on-time-ratio collect error is logged

- **WHEN** `onTimeRatioLastNPeriods` throws an error
- **THEN** `Logger.error` is called with a message identifying the
  `customreportReportsOnTimeRatio` gauge and the caught error value
- **AND** the error is not re-thrown

#### Scenario: active-leads collect error is logged

- **WHEN** `activeLeadsLastPublishedPeriod` throws an error
- **THEN** `Logger.error` is called with a message identifying the
  `customreportActiveLeadsTotal` gauge and the caught error value
- **AND** the error is not re-thrown
