## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`docker-compose.prod.yml` sets `OTEL_SDK_DISABLED=false` and
`OTEL_TRACES_SAMPLER_ARG=0.1` but never sets `OTEL_EXPORTER_OTLP_ENDPOINT`, so
`decideOtelBootstrap` (`apps/api/src/infrastructure/otel/otel.bootstrap.ts`)
always returns `{ started: false, reason: "no-endpoint" }` in prod: the two
`OTEL_*` vars read as "configured" while the SDK silently no-ops. The
`docker-compose.observability.yml` overlay already ships a prod-composable
collector (`grafana/otel-lgtm`, listening on `4318`) and documents
`docker compose -f docker-compose.prod.yml -f docker-compose.observability.yml
up -d` as a supported invocation — the collector exists, it just isn't wired.

Separately, even when an endpoint is set, the configured sampler is a bare
`TraceIdRatioBasedSampler(0.1)`, not `ParentBased`. A bare ratio sampler
re-dices every trace independently of the parent span's decision, so it both
drops ~90% of traces outright and can sample the api's span out of a trace
the browser already decided to keep — silently breaking the
`error-trace-correlation` spec's "share one trace id" guarantee even when
traces are flowing. For a low-volume internal tool, 90% loss has no
offsetting cost benefit.

Distributed traces are the primary tool for diagnosing "why did the report
hang" incidents; today they are effectively absent in prod even though the
collector and the api's OTel bootstrap already both exist.

Healthchecks called out in the same underlying finding are a separate,
already-split change — out of scope here.

## What Changes

- `docker-compose.prod.yml`: add `OTEL_EXPORTER_OTLP_ENDPOINT`, defaulting to
  `http://otel-lgtm:4318` (the service name the observability overlay
  publishes on the shared compose network), overridable for a managed
  collector; the top-of-file usage comment gains a line stating that prod
  tracing requires composing `docker-compose.observability.yml` (or pointing
  the var at an external collector) and that leaving both unset is still a
  valid choice (traces off, loud at boot — see below). Bump the
  `OTEL_TRACES_SAMPLER_ARG` default from `0.1` to `1.0` to match the new
  sampler default described next.
- `apps/api/src/infrastructure/otel/otel.bootstrap.ts`: wrap the trace
  sampler in `ParentBasedSampler` (`new ParentBasedSampler({ root: new
TraceIdRatioBasedSampler(ratio) })`) so a sampled-in browser trace is never
  re-diced out at the api hop; change `DEFAULT_TRACES_SAMPLING_RATIO` from
  `0.1` to `1.0` given the tool's low request volume. Update
  `otel.bootstrap.test.ts`'s default-ratio assertions to match.
- `apps/api/src/main.ts`: raise the "otel sdk disabled" boot log from `info`
  to `warn` so a prod boot with tracing off (no endpoint reachable, or the
  disabled flag) is loud in the log stream instead of blending into normal
  startup noise.

## Capabilities

### New Capabilities

- `prod-trace-sampling`: records that the prod OTLP endpoint defaults to the
  composed observability collector, that the trace sampler is
  `ParentBased` at a low-volume-appropriate default ratio, and that an
  untraced boot logs at `warn`.

### Modified Capabilities

(none)

## Impact

- `docker-compose.prod.yml`
- `apps/api/src/infrastructure/otel/otel.bootstrap.ts`
- `apps/api/src/infrastructure/otel/otel.bootstrap.test.ts`
- `apps/api/src/main.ts`

Non-goals: no healthcheck changes (separate split change); no change to
`docker-compose.observability.yml` itself; no tail-based sampling at the
collector (flagged as a future option by the finding, not adopted here);
operators pointing at a fully managed external collector simply override
`OTEL_EXPORTER_OTLP_ENDPOINT` and skip the overlay — both paths are
supported by the same default-with-override shape already used for
`LOG_LEVEL` and `OTEL_TRACES_SAMPLER_ARG` in this file.
