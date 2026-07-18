# observability-metrics-coverage Specification

## Purpose

Closes tracing and gauge blind spots: a batched tRPC HTTP request emits one OTel span per procedure, a W3C traceparent header propagates from the web client to the API, and a gauge never exports a stale value across a has-data-to-no-data transition.

## Requirements

### Requirement: A batched tRPC HTTP request MUST produce one OTel span per procedure

A single batched `POST /trpc` HTTP request carrying multiple procedure calls MUST produce one child span per procedure when OpenTelemetry tracing is enabled.
Each span MUST be distinguishable by procedure path and type, rather than
all procedures collapsing under a single HTTP-level span.

#### Scenario: A client batches two procedures into one HTTP request

- **WHEN** the web client sends a batched tRPC request invoking two
  procedures
- **THEN** the resulting trace contains two child spans, each attributed to
  its own procedure path
- **AND** neither procedure's Prisma queries are attributed to the other's
  span

### Requirement: A gauge MUST NOT export a stale value across a has-data-to-no-data transition

Any Prometheus gauge fed by a query that can legitimately return "no data" MUST clear or reset on a has-data-to-no-data transition rather than continuing to export its last-set value.
This applies for example to the on-time-ratio gauge when there is no
eligible published period.

#### Scenario: The on-time-ratio query has data, then has none

- **WHEN** `onTimeRatioLastNPeriods` returns a numeric value on one scrape
  cycle and `null` on a subsequent cycle
- **THEN** the gauge does not continue exporting the prior numeric value on
  the subsequent scrape
- **AND** the scrape output reflects the no-data state (e.g. `NaN` or an
  unset value) instead

### Requirement: A W3C traceparent header MUST propagate from the web client to the API

Outgoing web-client API requests MUST carry a W3C `traceparent` header,
derived from the active client-side trace context, whenever OpenTelemetry
tracing is enabled, so the resulting server-side span is correlated as a
child of the client-originated trace rather than starting an unrelated root
span — enabling cross-boundary correlation for client-observed errors and
requests.

#### Scenario: The web client issues an API request

- **WHEN** the web app sends a tRPC or fetch request to the API with
  OpenTelemetry web instrumentation active
- **THEN** the request carries a `traceparent` header derived from the
  active client-side trace context
- **AND** the API's `HttpInstrumentation` continues that trace context
  rather than starting an unrelated root span
