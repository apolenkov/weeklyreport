# error-trace-correlation Specification

## Purpose

Correlate errors and worker logs with OTel traces across browser, API, and BullMQ boundaries while redacting PII-shaped logger context centrally.

## Requirements

### Requirement: In-request errors carry their OTel trace id

An error captured while an OTel span is active MUST be sent to Bugsink with
`contexts.trace.trace_id` (and `span_id`) set to that span's ids, so the error
links to its trace in Tempo. The Sentry SDK MUST run with
`enableOpenTelemetrySetup: false` so the app's NodeSDK owns tracing and Tempo keeps
receiving spans. Transactions MUST NOT be sent to Bugsink (it stores errors
only). The shared policy MUST drop them through a supported span filter, not a
hook the SDK deprecates or removes, so a major upgrade cannot silently
re-enable transaction sending. The filter matches a transaction whose root span
name or op is non-empty; SDK-created roots carry both, so a root with neither
field passes the filter.

#### Scenario: An in-request error links to its Tempo trace

- **GIVEN** the api is handling an HTTP request inside an active OTel span
- **WHEN** an unhandled / ≥500 error is captured
- **THEN** the Bugsink event carries `contexts.trace.trace_id` equal to the
  active span's trace id, and that id resolves to a trace in Tempo

#### Scenario: An error with no active span is still reported

- **GIVEN** an error raised at boot, in a background job, or after context loss
- **WHEN** it is captured
- **THEN** it is sent to Bugsink without trace context, NOT dropped

#### Scenario: No transactions reach Bugsink

- **GIVEN** any Sentry runtime (api, Next server, Next edge, browser) and a
  transaction whose root span has a non-empty name or op
- **WHEN** the SDK would emit the transaction event
- **THEN** the shared privacy policy matches the transaction root, the SDK
  drops the transaction before send, and Bugsink receives only errors

#### Scenario: SDK upgrades preserve the privacy policy

- **GIVEN** any Sentry runtime (api, Next server, Next edge, browser)
- **WHEN** the SDK collects automatic event context
- **THEN** the shared data collection policy preserves restricted user, cookie,
  request body, AI input/output, database, queue, and GraphQL collection, with
  sensitive HTTP header and URL query keys excluded

### Requirement: Browser-originated requests share one trace id with the api

When the browser issues an instrumented same-origin request, the api MUST adopt
the browser's trace id so both appear under one trace id. The api MUST combine
W3C `traceparent` and Sentry `sentry-trace` propagation, preferring W3C when both
are present.

#### Scenario: Browser trace id reaches the api across the Next rewrite

- **GIVEN** the browser calls same-origin `/trpc` with browser tracing enabled
- **WHEN** Next rewrites the request to the api
- **THEN** the inbound Nest request carries the browser's `traceparent` header
  (and `sentry-trace` when the browser provides it), and the resulting Tempo
  trace id equals the browser-originated id

#### Scenario: W3C precedence when both headers are present

- **GIVEN** an inbound request with both `traceparent` and `sentry-trace`
  carrying different trace ids
- **WHEN** the api extracts the propagation context
- **THEN** the W3C `traceparent` trace id wins

### Requirement: Trace context crosses the BullMQ enqueue-to-worker boundary

The system MUST propagate the active W3C `traceparent` and the request
`correlationId` into BullMQ job data at every `queue.add`, and each worker
processor MUST start a span linked to that enqueue trace and restore the
`correlationId` into a `nestjs-cls` scope for the duration of the job. This
applies to the instrumented job processors (`pdf-export`, `email-reminder`); it
does not change the handling of genuinely span-less
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
- **WHEN** the job throws and an error reporter captures it inside the linked
  worker span
- **THEN** the captured error carries the trace id of the job's linked span, so
  it resolves to the same trace as the request that enqueued it

### Requirement: Worker logs flow through AppLogger with correlation context

Worker processors MUST emit their logs through `AppLogger` rather than
hand-building JSON to `process.stderr`, so every worker log entry carries the
job's `correlationId` (and trace id) and is forwarded to the configured
application log sinks like in-request logs. The PDF export path MUST
additionally emit per-step duration logs, including `renderer.render`. Its
Gotenberg conversion HTTP request MUST have an explicit timeout that covers
response-body consumption.

#### Scenario: A worker failure log carries correlation context

- **GIVEN** an instrumented worker processing a job seeded with a
  `correlationId`
- **WHEN** the job fails and the worker logs the failure
- **THEN** the entry is produced by `AppLogger`, carries the job's
  `correlationId`, and reaches the configured application log sinks (not only
  `process.stderr`)

#### Scenario: PDF export emits step timing and bounds page navigation

- **GIVEN** the PDF export worker is rendering a report
- **WHEN** it runs its happy path
- **THEN** it emits a duration log for each major step, including `renderer.render`
- **AND** the Gotenberg conversion HTTP request has an explicit timeout that
  covers response-body consumption, so a hung conversion or body read fails the
  job instead of stalling indefinitely

### Requirement: AppLogger redacts PII-shaped context fields

`AppLogger` MUST redact known PII-shaped context fields (starting with
`recipientEmail`) before an entry reaches any configured sink, so a caller
cannot leak personal data into stdout, the rotating file sink when configured,
or the OTLP/Loki forwarder when configured by passing it as a log context
value. Redaction MUST apply at the single
`emit` call site inside `AppLoggerImpl`, not per call site, so no log call can
bypass it.

#### Scenario: A log call with a recipient email is redacted at every configured sink

- **GIVEN** a call to `logger.info` (or `warn`/`error`) with a context object
  containing `recipientEmail`
- **WHEN** the entry is emitted
- **THEN** the value written to each configured stdout/stderr, file, or OTel
  log sink for that key is a fixed redaction marker, not the original email
  address

#### Scenario: A log call without PII-shaped keys is unaffected

- **GIVEN** a call to `logger.info` with a context object containing only
  non-PII fields (for example `ruleId`, `executionId`)
- **WHEN** the entry is emitted
- **THEN** every field's value is unchanged

### Requirement: Dev email diagnostics use AppLogger

The development no-send email diagnostic MUST be emitted through the shared
`AppLogger`, not a direct `process.stdout` write, so `LOG_LEVEL` gates it like
every other event and the PII context policy redacts the recipient before any
sink sees it. The subject and body MUST NOT be logged.

#### Scenario: A dev send emits a redacted, level-gated diagnostic

- **GIVEN** `EmailService` runs the no-send development transport
- **WHEN** a message is "delivered" by it
- **THEN** an `info` entry is emitted through `AppLogger` with the recipient
  under the `recipientEmail` context key
- **AND** every sink receives the redaction marker, not the raw address
- **AND** `LOG_LEVEL=error` suppresses the diagnostic entirely

### Requirement: Next.js loads server error instrumentation

The web application MUST place its server instrumentation hook where the
configured Next.js `src/app` layout discovers it. The hook MUST initialize the
matching Sentry server configuration for Node.js and Edge runtimes and MUST
forward Next.js request errors to `Sentry.captureRequestError`. A final
integrated production build MUST emit the server instrumentation artifact.
Acceptance tests MUST spy on the local SDK boundary and MUST NOT transmit
telemetry to an external service.

#### Scenario: Node.js runtime registers server instrumentation

- **GIVEN** Next.js invokes `register` with `NEXT_RUNTIME=nodejs`
- **WHEN** the hook runs
- **THEN** the Node.js Sentry initializer runs exactly once
- **AND** the Edge initializer does not run

#### Scenario: Edge runtime registers server instrumentation

- **GIVEN** Next.js invokes `register` with `NEXT_RUNTIME=edge`
- **WHEN** the hook runs
- **THEN** the Edge Sentry initializer runs exactly once
- **AND** the Node.js initializer does not run

#### Scenario: Next.js reports a server request error

- **GIVEN** a controlled server request error and a spied Sentry SDK
- **WHEN** Next.js calls the exported request-error hook
- **THEN** the hook forwards the original arguments to `Sentry.captureRequestError`
- **AND** no external telemetry request is made

#### Scenario: production build includes the hook

- **WHEN** the final integrated Next.js production build completes
- **THEN** its emitted server output contains the instrumentation artifact

### Requirement: Forwarded browser log events omit private free text

The opt-in browser log forwarding surface and its API ingress MUST project
events before they reach AppLogger. Stored and forwarded events MUST NOT carry
raw console arguments, error messages, stacks, user agents, URL credentials,
query strings or fragments. Only recognized event-source labels, fixed
diagnostic messages, level, timestamp, safe HTTP(S) URL origin/path and trusted
request attribution/correlation MAY reach the existing log sinks. Unknown URL
forms MUST be omitted. Existing opt-in and volume bounds MUST remain in force.

#### Scenario: Browser forwards an error containing private data

- **WHEN** console, window-error or unhandled-rejection data contains a private
  marker in text, stack, URL credentials, query or fragment
- **THEN** the forwarding batch and all configured API log sinks omit the marker
- **AND** source, severity and request correlation remain available

#### Scenario: Caller sends a raw batch directly to the API

- **WHEN** a client bypasses browser projection and submits raw private fields
  or an unrecognized source to the client-log ingress
- **THEN** API projection omits those fields or rejects the malformed batch
- **AND** raw free text does not reach stdout, stderr, file or OTel log sinks

### Requirement: Denied search audit records category without query text

The `search.query` denial audit MUST retain actor, role, request IP, correlation
and attempted scope, but MUST use a fixed search category as resource identity.
The rejected `q` value MUST NOT reach any configured application log sink.

#### Scenario: Search scope is denied

- **WHEN** a Lead or Viewer requests a forbidden search scope with private text
- **THEN** the existing scope-denied event identifies `search.query`
- **AND** it retains actor attribution without the query text
