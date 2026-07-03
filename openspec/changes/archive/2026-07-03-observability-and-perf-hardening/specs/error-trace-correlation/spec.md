## ADDED Requirements

### Requirement: Trace context crosses the BullMQ enqueue-to-worker boundary

The system MUST propagate the active W3C `traceparent` and the request
`correlationId` into BullMQ job data at every `queue.add`, and each worker
processor MUST start a span linked to that enqueue trace and restore the
`correlationId` into a `nestjs-cls` scope for the duration of the job. This
applies to the instrumented job processors (`pdf-export`, `email-reminder`,
`telegram-outbound`); it does not change the handling of genuinely span-less
captures (boot, context loss, uninstrumented paths), which remain covered by
the existing no-active-span requirement.

#### Scenario: An enqueued job continues its originating trace

- **GIVEN** a tRPC request inside an active OTel span enqueues a job via
  `queue.add`
- **WHEN** the worker later picks up that job
- **THEN** the job data carries the request's `traceparent` and `correlationId`
- **AND** the worker's processing span is linked to the originating trace rather
  than running as a parentless root span

#### Scenario: An error inside a worker links to the originating trace

- **GIVEN** an instrumented worker is processing a job seeded with the enqueue
  trace context
- **WHEN** the job throws and the error is captured
- **THEN** the captured error carries the trace id of the job's linked span, so
  it resolves to the same trace as the request that enqueued it

### Requirement: Worker logs flow through AppLogger with correlation context

Worker processors MUST emit their logs through `AppLogger` rather than
hand-building JSON to `process.stderr`, so every worker log entry carries the
job's `correlationId` (and trace id) and is forwarded to the OTLP/Loki and file
sinks like in-request logs. The PDF export path MUST additionally emit per-step
duration logs and apply an explicit timeout to `page.goto`.

#### Scenario: A worker failure log carries correlation context

- **GIVEN** an instrumented worker processing a job seeded with a
  `correlationId`
- **WHEN** the job fails and the worker logs the failure
- **THEN** the entry is produced by `AppLogger`, carries the job's
  `correlationId`, and reaches the OTLP/Loki and file sinks (not only
  `process.stderr`)

#### Scenario: PDF export emits step timing and bounds page navigation

- **GIVEN** the PDF export worker is rendering a report
- **WHEN** it runs its happy path
- **THEN** it emits a duration log for each major step
- **AND** `page.goto` is called with an explicit timeout so a hung navigation
  fails the job instead of stalling indefinitely
