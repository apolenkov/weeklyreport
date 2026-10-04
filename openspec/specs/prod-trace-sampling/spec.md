## Purpose

Defines production OTLP trace export configuration, sampling policy, and boot-time observability logging for the api service.

## Requirements

### Requirement: Production tracing is explicit and local overlays remain available

The production Helm chart MUST permit an explicitly empty `api.env.OTEL_EXPORTER_OTLP_ENDPOINT` as tracing off, and MUST use a managed collector only when the operator supplies its endpoint. The chart MUST NOT install a monitoring stack. The retained local `docker-compose.observability.yml` overlay MUST enable its internal collector for development Compose; it is not a production deployment path.

#### Scenario: Production tracing is explicitly disabled

- **GIVEN** Helm values set `api.env.OTEL_EXPORTER_OTLP_ENDPOINT` to an empty string
- **WHEN** the API container starts
- **THEN** tracing remains disabled and the disabled decision is logged at warn level

#### Scenario: The local observability overlay enables its internal collector

- **GIVEN** the documented development Compose and observability overlays are composed together
- **WHEN** the API container starts
- **THEN** the overlay sets `OTEL_EXPORTER_OTLP_ENDPOINT` to `http://otel-lgtm:4318`
- **AND** tracing is enabled

#### Scenario: An external managed collector is supplied

- **GIVEN** an operator sets `api.env.OTEL_EXPORTER_OTLP_ENDPOINT` to a managed collector URL and `api.env.OTEL_SDK_DISABLED=false` in Helm values
- **WHEN** the API container starts
- **THEN** tracing uses that endpoint without a Compose overlay

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
- **THEN** it returns `1.0`

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
