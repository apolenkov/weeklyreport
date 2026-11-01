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

DB-backed published-period gauges MUST calculate active leads and on-time
ratios from validated immutable publication snapshots. They MUST remain stable
when recovery omits mutable live sections, and a malformed settled snapshot
MUST clear the affected gauge through the existing collection error path rather
than silently exporting live-row drift.

#### Scenario: The on-time-ratio query has data, then has none

- **WHEN** `onTimeRatioLastNPeriods` returns a numeric value on one scrape
  cycle and `null` on a subsequent cycle
- **THEN** the gauge does not continue exporting the prior numeric value on
  the subsequent scrape
- **AND** the scrape output reflects the no-data state (e.g. `NaN` or an
  unset value) instead

#### Scenario: A recovered publication has no live sections

- **GIVEN** the latest settled report has a valid publication snapshot but no live section graph
- **WHEN** Prometheus collects the active-lead and on-time gauges
- **THEN** both values derive from the frozen snapshot and match publication-time facts

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

### Requirement: HTTP metric and access-log routes have bounded cardinality

Non-tRPC HTTP access logs and `http_request_duration_seconds` MUST use the same bounded route vocabulary. Known ingress families MAY use stable templates; every unmatched path MUST collapse to one fallback value rather than preserving request-controlled segments.

#### Scenario: An unmatched HTTP path is requested

- **WHEN** a client sends any number of distinct non-tRPC paths outside the known health, auth, PDF, queue, metrics, and client-log families
- **THEN** access logs and the latency metric record the same single unmatched route value without retaining attacker-controlled path segments

### Requirement: Telemetry headline represents the latest visible settled publication

The leadership telemetry.summary onTimeRatio MUST describe submitted sections in the newest admitted scoped settled snapshot and MUST be null when its submitted denominator is zero or no snapshot exists. The numeric sparkline MUST remain compact, oldest-first and at most four points. Both values MUST derive from one scoped immutable snapshot window; an older eligible ratio MUST NOT replace the latest headline. The pooled Prometheus gauge denominator remains unchanged.

#### Scenario: Latest scoped publication has no submitted sections

- **WHEN** the newest scoped snapshot contains only draft sections while an older snapshot has submitted sections
- **THEN** onTimeRatio is null and the older numeric ratio remains only in the compact sparkline

#### Scenario: Latest scoped publication has eligible sections

- **WHEN** the newest scoped snapshot has submitted sections
- **THEN** its on-time ratio supplies the headline and the same window supplies the oldest-first sparkline
