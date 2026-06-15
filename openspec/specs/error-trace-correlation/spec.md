# error-trace-correlation Specification

## Purpose

TBD - created by archiving change correlate-errors-to-traces. Update Purpose after archive.

## Requirements

### Requirement: In-request errors carry their OTel trace id

An error captured while an OTel span is active MUST be sent to Bugsink with
`contexts.trace.trace_id` (and `span_id`) set to that span's ids, so the error
links to its trace in Tempo. The Sentry SDK MUST run with
`skipOpenTelemetrySetup: true` so the app's NodeSDK owns tracing and Tempo keeps
receiving spans. Transactions MUST NOT be sent to Bugsink (it stores errors
only).

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

- **GIVEN** any Sentry runtime (api, Next server, Next edge, browser)
- **WHEN** the SDK would emit a transaction event
- **THEN** `beforeSendTransaction` drops it and Bugsink receives only errors

### Requirement: Browser-originated requests share one trace id with the api

When the browser issues an instrumented same-origin request, the api MUST adopt
the browser's trace id so both appear under one trace id. The api MUST combine
W3C `traceparent` and Sentry `sentry-trace` propagation, preferring W3C when both
are present.

#### Scenario: Browser trace id reaches the api across the Next rewrite

- **GIVEN** the browser calls same-origin `/trpc` with browser tracing enabled
- **WHEN** Next rewrites the request to the api
- **THEN** the inbound Nest request carries the `sentry-trace` header and the
  resulting Tempo trace id equals the browser-originated id

#### Scenario: W3C precedence when both headers are present

- **GIVEN** an inbound request with both `traceparent` and `sentry-trace`
  carrying different trace ids
- **WHEN** the api extracts the propagation context
- **THEN** the W3C `traceparent` trace id wins
