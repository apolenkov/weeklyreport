## Purpose

Defines production OTLP trace export configuration, sampling policy, and boot-time observability logging for the api service.

## Requirements

### Requirement: Prod OTLP endpoint defaults to the composed observability collector

The production compose file MUST set `OTEL_EXPORTER_OTLP_ENDPOINT` for the
api service, defaulting to the collector published by the
`docker-compose.observability.yml` overlay on the shared compose network, and
MUST remain overridable so an operator can point at a separately managed
collector instead. Leaving the endpoint unresolvable (overlay not composed,
no override set) MUST remain a valid "tracing off" configuration rather than
a required one.

#### Scenario: Endpoint resolves when the observability overlay is composed

- **GIVEN** `docker-compose.prod.yml` and `docker-compose.observability.yml`
  are composed together with no `OTEL_EXPORTER_OTLP_ENDPOINT` override
- **WHEN** the api container starts
- **THEN** `decideOtelBootstrap` receives a non-empty
  `OTEL_EXPORTER_OTLP_ENDPOINT` pointing at the composed collector
- **AND** `startOtel` returns `{ started: true, reason: "enabled" }`

#### Scenario: An external managed collector can be substituted

- **GIVEN** an operator sets `OTEL_EXPORTER_OTLP_ENDPOINT` to a managed
  collector's URL without composing `docker-compose.observability.yml`
- **WHEN** the api container starts
- **THEN** `decideOtelBootstrap` uses the operator-supplied endpoint, not the
  overlay's default

### Requirement: Trace sampling honors the parent span's decision at a low-volume-appropriate ratio

The api's Node SDK sampler MUST be `ParentBasedSampler`, wrapping a root
`TraceIdRatioBasedSampler` whose default ratio is `1.0`. A sampled-in parent
(e.g. a browser-originated trace) MUST always be sampled in at the api hop;
only root spans with no parent decision MUST consult the ratio.

#### Scenario: A sampled-in browser trace keeps its api span

- **GIVEN** the browser starts a trace and marks it sampled, then calls a
  same-origin `/trpc` route
- **WHEN** the api extracts the propagated context and starts its span
- **THEN** the api's span is sampled in regardless of the configured ratio,
  because `ParentBasedSampler` honors the upstream decision

#### Scenario: The default ratio is 1.0 for root spans

- **GIVEN** `OTEL_EXPORTER_OTLP_ENDPOINT` is set and `OTEL_TRACES_SAMPLER_ARG`
  is unset
- **WHEN** `decideOtelBootstrap` computes the sampling ratio
- **THEN** it returns `1.0`, not the prior `0.1` default

### Requirement: An untraced boot logs loud

The api MUST log a `startOtel` decision that does not start the SDK (disabled
flag or no reachable endpoint) at `warn` level, not `info`, so a prod boot
with tracing off is visible in the log stream rather than blending into
routine startup lines.

#### Scenario: A disabled-tracing boot emits a warn-level log

- **GIVEN** the api boots with `OTEL_SDK_DISABLED=true`, or with no resolvable
  `OTEL_EXPORTER_OTLP_ENDPOINT`
- **WHEN** `main.ts` logs the OTel bootstrap decision
- **THEN** the `otel sdk disabled` entry is emitted via `logger.warn`, not
  `logger.info`
